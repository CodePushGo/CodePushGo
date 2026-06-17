<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-vue-next'
import { completePasswordReset, createRegistrationClient, getRegistrationConfig, parseRecoveryParams, requestPasswordReset } from '../services/registration'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const params = new URLSearchParams(window.location.search)
const recoveryParams = parseRecoveryParams(window.location.search, window.location.hash)
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
      await requestPasswordReset(client, email.value, config)
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
  <main class="auth-shell compact-auth">
    <section class="auth-brand compact-brand">
      <a class="register-logo" href="/" aria-label="CodePushGo console">
        <span class="mark">CG</span>
        <span>CodePushGo</span>
      </a>
      <div class="register-copy">
        <p class="eyebrow">Console access</p>
        <h1>Password recovery</h1>
        <p>Recover access to your React Native OTA update console with Supabase Auth.</p>
      </div>
    </section>

    <section class="auth-panel" aria-labelledby="forgot-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">Forgot password</p>
          <h2 id="forgot-title">{{ title }}</h2>
        </div>
        <a href="/login">Sign in</a>
      </div>
      <p class="auth-note">{{ description }}</p>

      <form class="register-form" @submit.prevent="submit">
        <label v-if="step === 1">
          Email
          <input v-model="email" type="email" autocomplete="email" placeholder="you@company.com" required>
        </label>

        <template v-else>
          <label>
            New password
            <input v-model="password" type="password" autocomplete="new-password" minlength="8" required>
          </label>
          <label>
            Confirm password
            <input v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required>
          </label>
        </template>

        <p v-if="error" class="form-alert error">{{ error }}</p>
        <p v-if="message" class="form-alert success">
          <CheckCircle2 :size="16" />
          {{ message }}
        </p>

        <button class="primary register-submit" type="submit" :disabled="pending">
          <Loader2 v-if="pending" :size="16" class="spin" />
          <ArrowRight v-else :size="16" />
          {{ step === 1 ? 'Send reset link' : 'Update password' }}
        </button>
      </form>

      <a class="support-link" href="/login">
        <ArrowLeft :size="16" />
        Back to sign in
      </a>
    </section>
  </main>
</template>
