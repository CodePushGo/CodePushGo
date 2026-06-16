<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, CheckCircle2, Loader2, RadioTower, ShieldCheck, Zap } from 'lucide-vue-next'
import {
  createRegistrationClient,
  getRegistrationConfig,
  normalizePlanIntent,
  persistPlanIntent,
  readStoredPlanIntent,
  registerWithPlanIntent,
} from '../services/registration'

const params = new URLSearchParams(window.location.search)
const config = getRegistrationConfig()
const client = createRegistrationClient(config)
const intent = ref(normalizePlanIntent(params, readStoredPlanIntent()))
persistPlanIntent(intent.value)

const email = ref(params.get('email') || '')
const firstName = ref('')
const lastName = ref('')
const password = ref('')
const pending = ref(false)
const message = ref('')
const error = ref('')

const selectedPlanLabel = computed(() => `${intent.value.plan} / ${intent.value.billingPeriod}`)

const planOptions = [
  { plan: 'trial', label: 'Trial', detail: 'Start with React Native OTA updates' },
  { plan: 'solo', label: 'Solo', detail: 'One developer shipping production apps' },
  { plan: 'team', label: 'Team', detail: 'Shared release workflow and audit trail' },
]

function selectPlan(plan: string) {
  intent.value = { ...intent.value, plan }
  persistPlanIntent(intent.value)
}

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
    await registerWithPlanIntent(client, {
      email: email.value,
      password: password.value,
      firstName: firstName.value,
      lastName: lastName.value,
      intent: intent.value,
    })
    message.value = 'Account created. Check your email if confirmation is required.'
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
  <main class="register-shell">
    <section class="register-brand">
      <a class="register-logo" href="/" aria-label="CodePushGo console">
        <span class="mark">CG</span>
        <span>CodePushGo</span>
      </a>
      <div class="register-copy">
        <p class="eyebrow">React Native live updates</p>
        <h1>Sign up to CodePushGo</h1>
        <p>Ship JavaScript bundle updates through the same console flow your native bundle ID already uses.</p>
      </div>
      <div class="register-proof">
        <div>
          <Zap :size="18" />
          <span>Bundle uploads from CLI</span>
        </div>
        <div>
          <RadioTower :size="18" />
          <span>Channels and rollout controls</span>
        </div>
        <div>
          <ShieldCheck :size="18" />
          <span>Cloudflare Worker backend</span>
        </div>
      </div>
    </section>

    <section class="register-panel" aria-labelledby="register-title">
      <div class="register-head">
        <div>
          <p class="eyebrow">{{ selectedPlanLabel }}</p>
          <h2 id="register-title">Create account</h2>
        </div>
        <a :href="`${config.consoleUrl}/login/`">Sign in</a>
      </div>

      <div class="plan-picker" aria-label="Plan intent">
        <button
          v-for="option in planOptions"
          :key="option.plan"
          type="button"
          :class="{ active: intent.plan === option.plan }"
          @click="selectPlan(option.plan)"
        >
          <span>{{ option.label }}</span>
          <small>{{ option.detail }}</small>
        </button>
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
    </section>
  </main>
</template>
