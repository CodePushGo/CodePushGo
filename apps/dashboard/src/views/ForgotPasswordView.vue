<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-vue-next'
import AuthPageShell from '../components/auth/AuthPageShell.vue'
import { completePasswordReset, createRegistrationClient, getCaptchaTokenFromParams, getRegistrationConfig, parseRecoveryParams, requestPasswordReset } from '../services/registration'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const params = new URLSearchParams(window.location.search)
const recoveryParams = parseRecoveryParams(window.location.search, window.location.hash)
const captchaToken = getCaptchaTokenFromParams()
const step = ref(params.get('step') === '2' || recoveryParams.accessToken || recoveryParams.refreshToken || recoveryParams.code ? 2 : 1)

const email = ref(params.get('email') || '')
const password = ref('')
const confirmPassword = ref('')
const pending = ref(false)
const message = ref('')
const error = ref(recoveryParams.error ? recoveryParams.errorDescription || recoveryParams.error : '')

const title = computed(() => step.value === 1 ? 'Reset your password' : 'Choose a new password')
const description = computed(() => step.value === 1
  ? 'Enter your email and CodePushGo will send the same Supabase recovery link flow used by the console.'
  : 'Use the password reset link from your email to finish the change.')

async function submit() {
  error.value = ''
  message.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }

  if (step.value === 1 && !email.value.includes('@')) {
    error.value = 'Enter a valid email address.'
    return
  }

  if (step.value === 2) {
    if (password.value.length < 8) {
      error.value = 'Password must be at least 8 characters.'
      return
    }
    if (password.value !== confirmPassword.value) {
      error.value = 'Passwords do not match.'
      return
    }
  }

  pending.value = true
  try {
    if (step.value === 1) {
      await requestPasswordReset(client, email.value, config, captchaToken)
      message.value = 'Check your email for the password reset link.'
      return
    }

    await completePasswordReset(client, password.value, recoveryParams)
    window.location.assign('/app/home')
  }
  catch (submitError) {
    error.value = submitError instanceof Error ? submitError.message : String(submitError)
  }
  finally {
    pending.value = false
  }
}
</script>
<template>
  <AuthPageShell
    card-kicker="Forgot password"
    :card-title="title"
    :card-description="description"
    hero-kicker="Console access"
    hero-title="Password recovery"
    hero-description="Recover access to your React Native OTA update console with the same auth flow as the console."
    :chips="['Console', 'Recovery']"
    :hero-highlights="[
      { title: 'Secure reset', description: 'Use the recovery link from your inbox to finish the password change.' },
      { title: 'Same console session', description: 'Return directly to the console after the password is updated.' },
      { title: 'React Native OTA', description: 'Keep access to apps, channels, bundles, and logs.' },
    ]"
  >
    <form class="capgo-auth-form" @submit.prevent="submit">
      <label v-if="step === 1" class="capgo-auth-stack">
        <span class="capgo-auth-label">Email</span>
        <input v-model="email" class="capgo-auth-input" type="email" autocomplete="email" placeholder="you@company.com" required>
      </label>

      <template v-else>
        <label class="capgo-auth-stack">
          <span class="capgo-auth-label">New password</span>
          <input v-model="password" class="capgo-auth-input" type="password" autocomplete="new-password" minlength="8" required>
        </label>
        <label class="capgo-auth-stack">
          <span class="capgo-auth-label">Confirm password</span>
          <input v-model="confirmPassword" class="capgo-auth-input" type="password" autocomplete="new-password" minlength="8" required>
        </label>
      </template>

      <p v-if="error" class="form-alert error">{{ error }}</p>
      <p v-if="message" class="form-alert success">
        <CheckCircle2 :size="16" />
        {{ message }}
      </p>

      <button class="auth-primary-button" type="submit" :disabled="pending">
        <Loader2 v-if="pending" :size="16" class="spin" />
        <ArrowRight v-else :size="16" />
        {{ step === 1 ? 'Send reset link' : 'Update password' }}
      </button>
    </form>

    <template #footer>
      <a class="auth-inline-link" href="/login">
        <ArrowLeft :size="16" />
        Back to sign in
      </a>
    </template>
  </AuthPageShell>
</template>
