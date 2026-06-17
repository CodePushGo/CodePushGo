<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Loader2, TriangleAlert } from 'lucide-vue-next'
import { createRegistrationClient, getRegistrationConfig } from '../services/registration'
import { clearAuthParamsFromUrl, completeSsoCallback, parseSsoCallbackParams } from '../services/ssoCallback'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const pending = ref(true)
const error = ref('')

onMounted(async () => {
  const params = parseSsoCallbackParams(window.location.search, window.location.hash)
  window.history.replaceState({}, '', clearAuthParamsFromUrl(window.location.href))

  if (!client) {
    pending.value = false
    error.value = 'Supabase public config is missing.'
    return
  }

  try {
    const query = new URLSearchParams(window.location.search)
    const result = await completeSsoCallback(client, params, query.get('to'))
    window.location.assign(result.redirectTo)
  }
  catch (callbackError) {
    pending.value = false
    error.value = callbackError instanceof Error ? callbackError.message : String(callbackError)
  }
})
</script>

<template>
  <main class="auth-shell compact-auth">
    <section class="auth-brand compact-brand">
      <a class="register-logo" href="/" aria-label="CodePushGo console">
        <span class="mark">CG</span>
        <span>CodePushGo</span>
      </a>
      <div class="register-copy">
        <p class="eyebrow">SSO</p>
        <h1>Continue with SSO</h1>
        <p>Complete Supabase authentication and return to your CodePushGo console.</p>
      </div>
    </section>

    <section class="auth-panel" aria-labelledby="sso-callback-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">Console access</p>
          <h2 id="sso-callback-title">{{ pending ? 'Signing you in' : 'SSO sign in failed' }}</h2>
        </div>
        <a href="/login">Sign in</a>
      </div>

      <div class="auth-status-card">
        <Loader2 v-if="pending" :size="32" class="spin" />
        <TriangleAlert v-else :size="32" />
        <p v-if="pending">Please wait while CodePushGo verifies your Supabase session.</p>
        <p v-else>{{ error }}</p>
      </div>

      <a v-if="!pending" class="support-link" href="/login">Back to login page</a>
    </section>
  </main>
</template>
