<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from 'lucide-vue-next'
import { createRegistrationClient, getCaptchaTokenFromParams, getRegistrationConfig, normalizeRelativeReturnTo, resendSignupEmail } from '../services/registration'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const params = new URLSearchParams(window.location.search)
const captchaToken = getCaptchaTokenFromParams()
const returnTo = normalizeRelativeReturnTo(params.get('return_to'))

const email = ref(params.get('email') || '')
const pending = ref(false)
const message = ref('')
const error = ref('')
const reason = computed(() => params.get('reason'))
const description = computed(() => reason.value === 'email_not_verified'
  ? 'Verify your email before continuing. CodePushGo will send a fresh confirmation link.'
  : 'Send a fresh Supabase signup confirmation email for your CodePushGo account.')

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

  pending.value = true
  try {
    await resendSignupEmail(client, email.value, {
      config,
      captchaToken,
      returnTo,
    })
    message.value = 'Confirmation email sent.'
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
        <p class="eyebrow">Email confirmation</p>
        <h1>Resend email</h1>
        <p>{{ description }}</p>
      </div>
    </section>

    <section class="auth-panel" aria-labelledby="resend-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">Resend</p>
          <h2 id="resend-title">Confirmation email</h2>
        </div>
        <a href="/login">Sign in</a>
      </div>

      <form class="register-form" @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" placeholder="you@company.com" required>
        </label>

        <p v-if="error" class="form-alert error">{{ error }}</p>
        <p v-if="message" class="form-alert success">
          <CheckCircle2 :size="16" />
          {{ message }}
        </p>

        <button class="primary register-submit" type="submit" :disabled="pending">
          <Loader2 v-if="pending" :size="16" class="spin" />
          <ArrowRight v-else :size="16" />
          Resend
        </button>
      </form>

      <a class="support-link" :href="returnTo === '/login' ? '/login' : returnTo">
        <ArrowLeft :size="16" />
        Back
      </a>
    </section>
  </main>
</template>
