<script setup lang="ts">
import { CheckCircle2, Users } from 'lucide-vue-next'
import { useConsoleStore } from '../../stores/console'

const {
  pending,
  planRecorded,
  savePlanIntent,
  selectedBilling,
  selectedPlan,
} = useConsoleStore()
</script>

<template>
  <section class="dashboard-home-grid dashboard-content compact-content">
    <article class="plan-intent-card static-plan-card">
      <p class="eyebrow">Plan intent</p>
      <h2>Record the onboarding choice</h2>
      <div class="segmented" aria-label="Billing period">
        <button :class="{ active: selectedBilling === 'monthly' }" type="button" @click="selectedBilling = 'monthly'">Monthly</button>
        <button :class="{ active: selectedBilling === 'yearly' }" type="button" @click="selectedBilling = 'yearly'">Yearly</button>
      </div>
      <div class="plan-picker compact-plan-picker" aria-label="Plan intent">
        <button type="button" :class="{ active: selectedPlan === 'trial' }" @click="selectedPlan = 'trial'"><span>Trial</span><small>Validate live updates</small></button>
        <button type="button" :class="{ active: selectedPlan === 'solo' }" @click="selectedPlan = 'solo'"><span>Solo</span><small>One production app</small></button>
        <button type="button" :class="{ active: selectedPlan === 'team' }" @click="selectedPlan = 'team'"><span>Team</span><small>Shared release workflow</small></button>
      </div>
      <button class="primary" type="button" :disabled="pending || planRecorded" @click="savePlanIntent">
        <CheckCircle2 :size="16" />
        {{ planRecorded ? 'Saved' : 'Save plan intent' }}
      </button>
    </article>
    <article class="quickstart-card muted-card">
      <Users :size="24" />
      <h2>Team settings</h2>
      <p>Organization members, roles, and billing configuration will appear here as the Supabase migration tables are populated.</p>
    </article>
  </section>
</template>
