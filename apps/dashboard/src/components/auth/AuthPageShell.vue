<script setup lang="ts">
import { computed } from 'vue'

interface HighlightItem {
  title: string
  description: string
}

const props = withDefaults(defineProps<{
  badgeText?: string
  cardDescription?: string
  cardKicker?: string
  cardTitle: string
  cardWidthClass?: string
  chips?: string[]
  heroDescription?: string
  heroHighlights?: HighlightItem[]
  heroKicker?: string
  heroTitle?: string
}>(), {
  badgeText: '',
  cardDescription: '',
  cardKicker: '',
  cardWidthClass: 'auth-card-default',
  chips: undefined,
  heroDescription: '',
  heroHighlights: undefined,
  heroKicker: '',
  heroTitle: '',
})

const heroKickerValue = computed(() => props.heroKicker || 'React Native live updates')
const heroTitleValue = computed(() => props.heroTitle || 'Ship updates without waiting on the stores')
const heroDescriptionValue = computed(() => props.heroDescription || 'CodePushGo keeps the Capgo console workflow and adapts releases, channels, devices, and rollouts to React Native bundle IDs.')
const heroChips = computed(() => props.chips ?? [
  'Live updates',
  'Release analytics',
  'Channel control',
])
const heroHighlights = computed(() => props.heroHighlights ?? [
  {
    title: 'Rollouts',
    description: 'Promote JavaScript bundles across channels with the same console flow.',
  },
  {
    title: 'Observability',
    description: 'Track releases, devices, update stats, and compatibility signals.',
  },
  {
    title: 'Teams',
    description: 'Keep organization access, API keys, and audit workflows together.',
  },
])
</script>

<template>
  <section class="auth-page-shell">
    <div class="auth-page-bg" aria-hidden="true">
      <div class="auth-page-orb auth-page-orb-a" />
      <div class="auth-page-orb auth-page-orb-b" />
      <div class="auth-page-grid" />
    </div>

    <div class="auth-page-inner">
      <section class="auth-hero-panel">
        <div class="auth-hero-content">
          <div class="auth-chip-row">
            <span v-for="chip in heroChips" :key="chip" class="auth-chip">
              {{ chip }}
            </span>
          </div>

          <div class="auth-hero-copy">
            <div class="auth-logo-tile">
              <span class="mark">CG</span>
            </div>
            <div>
              <p class="auth-kicker">{{ heroKickerValue }}</p>
              <h1>{{ heroTitleValue }}</h1>
              <p>{{ heroDescriptionValue }}</p>
            </div>
          </div>

          <div class="auth-highlight-grid">
            <article v-for="highlight in heroHighlights" :key="highlight.title" class="auth-highlight-card">
              <div class="auth-highlight-bar" />
              <h2>{{ highlight.title }}</h2>
              <p>{{ highlight.description }}</p>
            </article>
          </div>
        </div>
      </section>

      <div class="auth-card-column" :class="cardWidthClass">
        <div class="auth-mobile-brand">
          <span class="auth-mobile-mark mark">CG</span>
          <div>
            <p>{{ heroKickerValue }}</p>
            <strong>CodePushGo</strong>
          </div>
        </div>

        <div class="auth-card-shell">
          <div class="auth-card-header">
            <div>
              <p v-if="cardKicker" class="auth-card-kicker">{{ cardKicker }}</p>
              <h2>{{ cardTitle }}</h2>
              <p v-if="cardDescription">{{ cardDescription }}</p>
            </div>
            <span v-if="badgeText" class="auth-card-badge">{{ badgeText }}</span>
          </div>

          <div class="auth-card-body">
            <slot />
          </div>
        </div>

        <slot name="footer" />
      </div>
    </div>
  </section>
</template>
