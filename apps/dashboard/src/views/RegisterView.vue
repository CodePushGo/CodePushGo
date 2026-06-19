<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, CheckCircle2, Loader2, Mail, ShieldCheck, Terminal, Zap } from 'lucide-vue-next'
import { createConfirmedAccount, createRegistrationClient, getCaptchaTokenFromParams, getRegistrationConfig, loginAccount } from '../services/registration'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const params = new URLSearchParams(window.location.search)
const captchaToken = getCaptchaTokenFromParams()

const email = ref(params.get('email') || '')
const firstName = ref('')
const lastName = ref('')
const password = ref('')
const pending = ref(false)
const message = ref('')
const error = ref('')

function validateName(value: string) {
  return /^[\p{L}\s'-]+$/u.test(value.trim())
}

async function submit() {
  error.value = ''
  message.value = ''

  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }
  if (!email.value.includes('@')) {
    error.value = 'Enter a valid email address.'
    return
  }
  if (!validateName(firstName.value) || !validateName(lastName.value)) {
    error.value = 'Name can only contain letters, spaces, hyphens, and apostrophes.'
    return
  }
  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }

  pending.value = true
  try {
    const input = {
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
      captchaToken,
    }
    await createConfirmedAccount(input, config)
    await loginAccount(client, input)
    window.location.assign('/app/home')
    return
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
  <main class="auth-shell auth-shell-register">
    <section class="auth-brand">
      <a class="register-logo" href="/" aria-label="CodePushGo console">
        <span class="mark">CG</span>
        <span>CodePushGo</span>
      </a>
      <div class="register-copy">
        <p class="eyebrow">React Native live updates</p>
        <h1>Sign up to CodePushGo</h1>
        <p>Ship JavaScript bundle updates with the same app identity your React Native native project already has.</p>
      </div>
      <div class="register-proof">
        <div>
          <Terminal :size="18" />
          <span>CLI detects your native bundle ID</span>
        </div>
        <div>
          <Zap :size="18" />
          <span>Bundle upload, channels, rollout</span>
        </div>
        <div>
          <ShieldCheck :size="18" />
          <span>Supabase auth and Worker backend</span>
        </div>
      </div>
    </section>

    <section class="auth-panel" aria-labelledby="register-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">Create account</p>
          <h2 id="register-title">Start with email</h2>
        </div>
        <a href="/login">Sign in</a>
      </div>

      <form class="register-form" @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" placeholder="you@company.com" required>
        </label>
        <div class="form-grid">
          <label>
            First name
            <input v-model="firstName" autocomplete="given-name" placeholder="Jane" required>
          </label>
          <label>
            Last name
            <input v-model="lastName" autocomplete="family-name" placeholder="Doe" required>
          </label>
        </div>
        <label>
          Password
          <input v-model="password" type="password" autocomplete="new-password" minlength="8" required>
        </label>
        <p v-if="error" class="form-alert error">{{ error }}</p>
        <p v-if="message" class="form-alert success">
          <CheckCircle2 :size="16" />
          {{ message }}
        </p>
        <button class="primary register-submit" type="submit" :disabled="pending">
          <Loader2 v-if="pending" :size="16" class="spin" />
          <ArrowRight v-else :size="16" />
          Sign up
        </button>
      </form>

      <p class="auth-note">
        Plan selection happens inside console onboarding, after the account exists.
      </p>
      <a class="support-link" href="mailto:support@codepushgo.com">
        <Mail :size="16" />
        Need help?
      </a>
    </section>
  </main>
</template>
