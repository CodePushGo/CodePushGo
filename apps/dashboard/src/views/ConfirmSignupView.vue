<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Loader2, TriangleAlert } from 'lucide-vue-next'
import { resolveConfirmationRedirect } from '../services/confirmationRedirect'
import { getRegistrationConfig } from '../services/registration'

const config = getRegistrationConfig()
const redirecting = ref(true)
const error = ref('')

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const result = resolveConfirmationRedirect(params.get('confirmation_url'), {
    consoleUrl: config.consoleUrl,
    supabaseUrl: config.supabaseUrl,
    dev: import.meta.env.DEV,
    origin: window.location.origin,
  })

  if (!result.ok || !result.url) {
    redirecting.value = false
    error.value = result.message || 'Invalid confirmation URL. Please check your email link.'
    return
  }

  window.location.href = result.url
})
</script>

<template>
  <main class="auth-shell compact-auth">
    <section class="auth-brand compact-brand">
      <a class="register-logo" href="/" aria-label="CodePushGo console">
        <img src="/codepushgo-logo.svg" alt="" width="42" height="42" class="auth-mobile-logo">
        <span>CodePushGo</span>
      </a>
      <div class="register-copy">
        <p class="eyebrow">Secure redirect</p>
        <h1>Email confirmation</h1>
        <p>CodePushGo only forwards confirmation links to approved console and Supabase hosts.</p>
      </div>
    </section>

    <section class="auth-panel" aria-labelledby="confirm-signup-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">Confirm signup</p>
          <h2 id="confirm-signup-title">{{ redirecting ? 'Redirecting' : 'Confirmation link blocked' }}</h2>
        </div>
        <a href="/login">Sign in</a>
      </div>

      <div class="auth-status-card">
        <Loader2 v-if="redirecting" :size="32" class="spin" />
        <TriangleAlert v-else :size="32" />
        <p v-if="redirecting">Please wait while we redirect you to confirm your email address.</p>
        <p v-else>{{ error }}</p>
      </div>

      <a v-if="!redirecting" class="support-link" href="/login">Back to login page</a>
    </section>
  </main>
</template>
