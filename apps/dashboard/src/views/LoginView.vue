<script setup lang="ts">
import { ref } from 'vue'
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-vue-next'
import { createRegistrationClient, getRegistrationConfig, loginAccount } from '../services/registration'

const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const email = ref('')
const password = ref('')
const pending = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }

  pending.value = true
  try {
    await loginAccount(client, { email: email.value, password: password.value })
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
        <p class="eyebrow">React Native live updates</p>
        <h1>Welcome back</h1>
        <p>Open your apps, channels, releases, and onboarding from the console.</p>
      </div>
    </section>

    <section class="auth-panel" aria-labelledby="login-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">Console</p>
          <h2 id="login-title">Sign in</h2>
        </div>
        <a href="/register">Create account</a>
      </div>

      <form class="register-form" @submit.prevent="submit">
        <label>
          Email
          <input v-model="email" type="email" autocomplete="email" required>
        </label>
        <label>
          Password
          <input v-model="password" type="password" autocomplete="current-password" required>
        </label>
        <p v-if="error" class="form-alert error">{{ error }}</p>
        <button class="primary register-submit" type="submit" :disabled="pending">
          <Loader2 v-if="pending" :size="16" class="spin" />
          <ArrowRight v-else :size="16" />
          Sign in
        </button>
      </form>

      <p class="auth-note icon-note">
        <ShieldCheck :size="16" />
        Auth is handled by the CodePushGo Supabase project.
      </p>
    </section>
  </main>
</template>
