<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Building2, CheckCircle2, Loader2 } from 'lucide-vue-next'
import { createDashboardClient, createOrganizationOnboarding, normalizeBillingPeriod, normalizePlan } from '../services/registration'
import { useOrganizationStore } from '../stores/organization'

const client = createDashboardClient()
const organizationStore = useOrganizationStore()
const params = new URLSearchParams(window.location.search)
const nextPath = computed(() => {
  const target = params.get('to') || '/app/home'
  return target.startsWith('/') && !target.startsWith('//') ? target : '/app/home'
})
const orgName = ref('')
const selectedPlan = ref(normalizePlan(params.get('plan')))
const selectedBilling = ref(normalizeBillingPeriod(params.get('billing') || params.get('interval')))
const pending = ref(false)
const error = ref('')
const notice = ref('')

async function submit() {
  error.value = ''
  notice.value = ''
  if (!client) {
    error.value = 'Supabase public config is missing.'
    return
  }
  if (!orgName.value.trim()) {
    error.value = 'Organization name is required.'
    return
  }

  pending.value = true
  try {
    await createOrganizationOnboarding(client, {
      name: orgName.value,
      plan: selectedPlan.value,
      billingPeriod: selectedBilling.value,
      metadata: {
        source: 'organization_onboarding',
        next: nextPath.value,
      },
    })
    await organizationStore.dedupFetchOrganizations()
    notice.value = 'Organization created.'
    window.location.assign(nextPath.value)
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
  <main class="onboarding-page">
    <form class="onboarding-panel" @submit.prevent="submit">
      <div class="onboarding-icon">
        <Building2 :size="28" />
      </div>
      <p class="eyebrow">Organization onboarding</p>
      <h1>Create your CodePushGo organization</h1>
      <p>Set the organization that owns your React Native apps, bundle IDs, API keys, and team access.</p>

      <label>
        Organization name
        <input v-model="orgName" type="text" autocomplete="organization" placeholder="Acme Mobile" required>
      </label>

      <div class="segmented" aria-label="Billing period">
        <button :class="{ active: selectedBilling === 'monthly' }" type="button" @click="selectedBilling = 'monthly'">Monthly</button>
        <button :class="{ active: selectedBilling === 'yearly' }" type="button" @click="selectedBilling = 'yearly'">Yearly</button>
      </div>

      <div class="plan-picker compact-plan-picker" aria-label="Plan intent">
        <button type="button" :class="{ active: selectedPlan === 'trial' }" @click="selectedPlan = 'trial'"><span>Trial</span><small>Validate OTA updates</small></button>
        <button type="button" :class="{ active: selectedPlan === 'solo' }" @click="selectedPlan = 'solo'"><span>Solo</span><small>One production app</small></button>
        <button type="button" :class="{ active: selectedPlan === 'team' }" @click="selectedPlan = 'team'"><span>Team</span><small>Shared release workflow</small></button>
      </div>

      <p v-if="error" class="form-alert error">{{ error }}</p>
      <p v-if="notice" class="form-alert success">
        <CheckCircle2 :size="16" />
        {{ notice }}
      </p>

      <button class="primary register-submit" type="submit" :disabled="pending">
        <Loader2 v-if="pending" :size="16" class="spin" />
        <ArrowRight v-else :size="16" />
        Create organization
      </button>
    </form>
  </main>
</template>
