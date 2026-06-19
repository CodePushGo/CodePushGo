<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from 'lucide-vue-next'
import AuthPageShell from '../components/auth/AuthPageShell.vue'
import { authInlineLinkClass, authPanelClass, authPrimaryButtonClass, authSecondaryButtonClass } from '../components/auth/pageStyles'
import { bootstrapAuthSession, createRegistrationClient, getRegistrationConfig, loginAccount, parseRecoveryParams, verifyLoginMfa } from '../services/registration'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const route = useRoute()

const isLoading = ref(false)
const isDomainChecking = ref(false)
const isCheckingSavedSession = ref(false)
const statusAuth = ref<'email' | 'credentials' | 'mfa'>('email')
const emailForLogin = ref(typeof route.query.email === 'string' ? route.query.email : '')
const password = ref('')
const mfaCode = ref('')
const mfaFactorId = ref('')
const mfaChallengeId = ref('')
const error = ref('')
const message = ref('')
const hasSso = ref(false)
const enforceSso = ref(false)

const isEmailStepBusy = computed(() => isDomainChecking.value || isCheckingSavedSession.value)
const isEmailNotVerified = computed(() => route.query.reason === 'email_not_verified' || route.query.error === 'email_not_verified' || route.query.error_code === 'email_not_verified')
const resendEmailUrl = computed(() => {
  const params = new URLSearchParams()
  const email = emailForLogin.value.trim().toLowerCase()
  if (email)
    params.set('email', email)
  params.set('reason', 'email_not_verified')
  params.set('return_to', safeRedirectPath())
  return `/resend_email?${params}`
})
const heroChips = ['Live updates', 'Release analytics', 'Channel control']
const heroHighlights = [
  {
    title: 'Rollouts',
    description: 'Promote React Native JavaScript bundles across channels with the Capgo console flow.',
  },
  {
    title: 'Observability',
    description: 'Open releases, devices, update stats, and compatibility signals from one console.',
  },
  {
    title: 'Teams',
    description: 'Keep organization access, API keys, and audit workflow aligned with production.',
  },
]
const registerUrl = globalThis.location.host === 'console.codepushgo.com' ? 'https://codepushgo.com/register/' : '/register/'

function safeRedirectPath() {
  const target = route.query.to
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//'))
    return target
  return '/app/home'
}

function clearLoginAuthParamsFromUrl(href: string) {
  const url = new URL(href)
  const hashParams = new URLSearchParams(url.hash.replace('#', ''))
  for (const key of ['access_token', 'refresh_token', 'code', 'error', 'error_description']) {
    url.searchParams.delete(key)
    hashParams.delete(key)
  }
  const nextHash = hashParams.toString()
  url.hash = nextHash ? `#${nextHash}` : ''
  return url.toString()
}

function focusLoginEmailInput(attempt = 0) {
  globalThis.setTimeout(() => {
    const emailInput = document.querySelector<HTMLInputElement>('input#login-email')
    if (!emailInput || emailInput.disabled) {
      if (attempt < 8)
        focusLoginEmailInput(attempt + 1)
      return
    }

    emailInput.focus()
    emailInput.select()

    if (document.activeElement !== emailInput && attempt < 8)
      focusLoginEmailInput(attempt + 1)
  }, attempt === 0 ? 240 : 100)
}

async function checkDomain(email: string): Promise<{ has_sso: boolean, enforce_sso?: boolean }> {
  try {
    const response = await fetch(`${config.apiUrl.replace(/\/+$/, '')}/private/sso/check-domain`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!response.ok)
      return { has_sso: false }
    return await response.json() as { has_sso: boolean, enforce_sso?: boolean }
  }
  catch {
    return { has_sso: false }
  }
}

async function handleEmailContinue() {
  error.value = ''
  message.value = ''
  const email = emailForLogin.value.trim().toLowerCase()
  if (!email.includes('@')) {
    error.value = 'Enter a valid email address.'
    return
  }

  isDomainChecking.value = true
  emailForLogin.value = email
  const result = await checkDomain(email)
  hasSso.value = result.has_sso
  enforceSso.value = result.enforce_sso === true
  isDomainChecking.value = false
  statusAuth.value = 'credentials'
}

async function handlePasswordSubmit() {
  error.value = ''
  message.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }
  if (!password.value) {
    error.value = 'Password is required.'
    return
  }

  isLoading.value = true
  try {
    const result = await loginAccount(client, { email: emailForLogin.value, password: password.value })
    if (result.status === 'mfa_required') {
      mfaFactorId.value = result.factorId || ''
      mfaChallengeId.value = result.challengeId || ''
      mfaCode.value = ''
      statusAuth.value = 'mfa'
      message.value = 'Enter your two-factor authentication code to continue.'
      return
    }
    window.location.assign(safeRedirectPath())
  }
  catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : String(submitError)
  }
  finally {
    isLoading.value = false
  }
}

async function handleMfaSubmit() {
  error.value = ''
  message.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }
  const code = mfaCode.value.replaceAll(' ', '').trim()
  if (!code) {
    error.value = 'Enter your two-factor authentication code.'
    return
  }

  isLoading.value = true
  try {
    await verifyLoginMfa(client, {
      factorId: mfaFactorId.value,
      challengeId: mfaChallengeId.value,
      code,
    })
    window.location.assign(safeRedirectPath())
  }
  catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : String(submitError)
  }
  finally {
    isLoading.value = false
  }
}

async function handleSsoLogin() {
  error.value = ''
  message.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }

  const domain = emailForLogin.value.split('@')[1]
  if (!domain) {
    error.value = 'Enter a valid email address.'
    return
  }

  isLoading.value = true
  try {
    const redirectUrl = new URL('/sso-callback', globalThis.location.origin)
    const target = route.query.to
    if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//'))
      redirectUrl.searchParams.set('to', target)

    const { data, error: ssoError } = await client.auth.signInWithSSO({
      domain,
      options: { redirectTo: redirectUrl.toString() },
    })

    if (ssoError)
      throw ssoError
    if (data?.url)
      globalThis.location.href = data.url
  }
  catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : String(submitError)
    isLoading.value = false
  }
}

async function goBackToEmail() {
  if (isLoading.value)
    return
  statusAuth.value = 'email'
  hasSso.value = false
  enforceSso.value = false
  password.value = ''
  mfaCode.value = ''
  mfaFactorId.value = ''
  mfaChallengeId.value = ''
  error.value = ''
  message.value = ''
  await nextTick()
  focusLoginEmailInput()
}

onMounted(async () => {
  if (route.query.sso_linked === 'true')
    message.value = 'SSO identity linked. Sign in to continue.'
  else if (isEmailNotVerified.value)
    error.value = 'Please verify your email before continuing.'

  const authParams = parseRecoveryParams(window.location.search, window.location.hash)
  if (!authParams.accessToken && !authParams.refreshToken && !authParams.code && !authParams.error)
    return

  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }

  isCheckingSavedSession.value = true
  try {
    const didBootstrap = await bootstrapAuthSession(client, authParams)
    window.history.replaceState({}, '', clearLoginAuthParamsFromUrl(window.location.href))
    if (didBootstrap)
      window.location.assign(safeRedirectPath())
  }
  catch (bootstrapError) {
    error.value = bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError)
  }
  finally {
    isCheckingSavedSession.value = false
  }
})
</script>

<template>
  <AuthPageShell
    card-kicker="Console"
    card-title="Sign in"
    card-description="Use the same account flow as Capgo, adapted for CodePushGo React Native updates."
    hero-kicker="React Native live updates"
    hero-title="Ship updates without waiting on the stores"
    hero-description="CodePushGo keeps the Capgo console workflow and adapts releases, channels, devices, and rollouts to React Native bundle IDs."
    :chips="heroChips"
    :hero-highlights="heroHighlights"
  >
    <div class="capgo-auth-stack">
      <form v-if="statusAuth === 'email'" class="capgo-auth-form" data-test="login-email-step" @submit.prevent="handleEmailContinue">
        <label class="capgo-auth-label" for="login-email">
          Email
        </label>
        <input
          id="login-email"
          v-model="emailForLogin"
          class="capgo-auth-input"
          type="email"
          autocomplete="email"
          inputmode="email"
          enterkeyhint="next"
          required
          autofocus
          data-test="email"
        >

        <p v-if="message" class="form-alert success" data-test="form-message">{{ message }}</p>
        <p v-if="error" class="form-alert error" data-test="form-error">
          {{ error }}
          <a v-if="isEmailNotVerified" :href="resendEmailUrl" :class="authInlineLinkClass">Resend confirmation email</a>
        </p>

        <button :class="authPrimaryButtonClass" type="submit" :disabled="isEmailStepBusy">
          <Loader2 v-if="isEmailStepBusy" :size="18" class="spin" />
          <ArrowRight v-else :size="18" />
          Continue
        </button>
      </form>

      <form v-else-if="statusAuth === 'credentials'" class="capgo-auth-form" data-test="login-password-step" @submit.prevent="handlePasswordSubmit">
        <div class="auth-account-context">
          <span class="auth-selected-email">{{ emailForLogin }}</span>
          <button class="auth-back-email-button" type="button" :disabled="isLoading" @click="goBackToEmail">
            <ArrowLeft :size="15" />
            Change
          </button>
        </div>

        <div v-if="hasSso" class="auth-inset-card">
          <p class="auth-sso-title">Single sign-on available</p>
          <p class="auth-sso-copy">
            Continue with your organization SSO provider.
          </p>
          <button :class="authSecondaryButtonClass" type="button" :disabled="isLoading" @click="handleSsoLogin">
            <Loader2 v-if="isLoading && enforceSso" :size="18" class="spin" />
            Continue with SSO
          </button>
        </div>

        <template v-if="!enforceSso">
          <label class="capgo-auth-label" for="login-password">
            Password
          </label>
          <input
            id="login-password"
            v-model="password"
            class="capgo-auth-input"
            type="password"
            autocomplete="current-password"
            required
            data-test="password"
          >

          <div class="capgo-auth-row">
            <a href="/forgot_password" :class="authInlineLinkClass">Forgot password?</a>
          </div>

          <p v-if="error" class="form-alert error" data-test="form-error">{{ error }}</p>

          <button :class="authPrimaryButtonClass" type="submit" :disabled="isLoading">
            <Loader2 v-if="isLoading" :size="18" class="spin" />
            <ArrowRight v-else :size="18" />
            Sign in
          </button>
        </template>

        <p v-if="error && enforceSso" class="form-alert error" data-test="form-error">{{ error }}</p>
      </form>

      <form v-else class="capgo-auth-form" data-test="login-mfa-step" @submit.prevent="handleMfaSubmit">
        <div class="auth-account-context">
          <span class="auth-selected-email">{{ emailForLogin }}</span>
          <button class="auth-back-email-button" type="button" :disabled="isLoading" @click="goBackToEmail">
            <ArrowLeft :size="15" />
            Change
          </button>
        </div>

        <label class="capgo-auth-label" for="login-mfa-code">
          Two-factor code
        </label>
        <input
          id="login-mfa-code"
          v-model="mfaCode"
          class="capgo-auth-input"
          inputmode="numeric"
          autocomplete="one-time-code"
          required
          data-test="mfa-code"
        >

        <p v-if="message" class="form-alert success" data-test="form-message">{{ message }}</p>
        <p v-if="error" class="form-alert error" data-test="form-error">{{ error }}</p>

        <button :class="authPrimaryButtonClass" type="submit" :disabled="isLoading">
          <Loader2 v-if="isLoading" :size="18" class="spin" />
          <ArrowRight v-else :size="18" />
          Verify code
        </button>
      </form>

      <div :class="authPanelClass">
        <p>Need an account?</p>
        <a :href="registerUrl" :class="authInlineLinkClass">Create account</a>
      </div>
    </div>

    <template #footer>
      <section class="auth-footer-actions">
        <a href="mailto:support@codepushgo.com" class="auth-ghost-button">Support</a>
        <p class="auth-note icon-note">
          <ShieldCheck :size="16" />
          Auth is handled by the CodePushGo Supabase project.
        </p>
      </section>
    </template>
  </AuthPageShell>
</template>
