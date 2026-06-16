<script setup lang="ts">
import { CheckCircle2, Copy } from 'lucide-vue-next'

export interface OnboardingStep {
  title: string
  command: string
  subtitle: string
}

defineProps<{
  steps: OnboardingStep[]
  copiedCommand: string
  selectedPlan: string
  selectedBilling: 'monthly' | 'yearly'
  pending: boolean
  planRecorded: boolean
}>()

const emit = defineEmits<{
  copyCommand: [command: string]
  savePlanIntent: []
  updateSelectedPlan: [plan: string]
  updateSelectedBilling: [billing: 'monthly' | 'yearly']
}>()
</script>

<template>
  <section class="steps-screen">
    <div class="steps-heading">
      <small>React Native onboarding</small>
      <h1>Connect your first app with its native bundle ID</h1>
      <p>Run the CLI in the React Native project and the console will fill with apps, bundles, channels, devices, and stats.</p>
    </div>

    <div class="steps-layout">
      <article class="plan-intent-card">
        <p class="eyebrow">Plan intent</p>
        <h2>Choose during onboarding</h2>
        <div class="segmented" aria-label="Billing period">
          <button :class="{ active: selectedBilling === 'monthly' }" type="button" @click="emit('updateSelectedBilling', 'monthly')">Monthly</button>
          <button :class="{ active: selectedBilling === 'yearly' }" type="button" @click="emit('updateSelectedBilling', 'yearly')">Yearly</button>
        </div>
        <div class="plan-picker compact-plan-picker" aria-label="Plan intent">
          <button type="button" :class="{ active: selectedPlan === 'trial' }" @click="emit('updateSelectedPlan', 'trial')">
            <span>Trial</span>
            <small>Validate live updates</small>
          </button>
          <button type="button" :class="{ active: selectedPlan === 'solo' }" @click="emit('updateSelectedPlan', 'solo')">
            <span>Solo</span>
            <small>One production app</small>
          </button>
          <button type="button" :class="{ active: selectedPlan === 'team' }" @click="emit('updateSelectedPlan', 'team')">
            <span>Team</span>
            <small>Shared release workflow</small>
          </button>
        </div>
        <button class="primary" type="button" :disabled="pending || planRecorded" @click="emit('savePlanIntent')">
          <CheckCircle2 :size="16" />
          {{ planRecorded ? 'Saved' : 'Save plan intent' }}
        </button>
      </article>

      <div class="capgo-steps-list">
        <template v-for="(item, index) in steps" :key="item.title">
          <article class="capgo-step">
            <span class="capgo-step-index">{{ index + 1 }}</span>
            <div>
              <h2>{{ item.title }}</h2>
              <button class="command" type="button" @click="emit('copyCommand', item.command)">
                <code>{{ item.command }}</code>
                <Copy :size="16" />
              </button>
              <p>{{ copiedCommand === item.command ? 'Copied to clipboard' : item.subtitle }}</p>
            </div>
          </article>
          <span v-if="index < steps.length - 1" class="step-connector" aria-hidden="true" />
        </template>
      </div>
    </div>
  </section>
</template>
