<script setup lang="ts">
defineProps<{
  name: string
}>()
</script>

<template>
  <div class="welcome-banner">
    <div class="welcome-art" aria-hidden="true">
      <svg width="319" height="198" viewBox="0 0 319 198">
        <defs>
          <path id="welcome-a" d="M64 0l64 128-64-20-64 20z" />
          <path id="welcome-e" d="M40 0l40 80-40-12.5L0 80z" />
          <linearGradient id="welcome-b" x1="50%" x2="50%" y1="0%" y2="100%">
            <stop stop-color="#9fbfff" offset="0%" />
            <stop stop-color="#2563eb" offset="100%" />
          </linearGradient>
          <linearGradient id="welcome-c" x1="50%" x2="50%" y1="24.537%" y2="100%">
            <stop stop-color="#116149" offset="0%" />
            <stop stop-color="#2563eb" stop-opacity="0" offset="100%" />
          </linearGradient>
        </defs>
        <g fill="none" fill-rule="evenodd">
          <g transform="rotate(64 36.592 105.604)">
            <mask id="welcome-d" fill="#fff">
              <use href="#welcome-a" />
            </mask>
            <use fill="url(#welcome-b)" href="#welcome-a" />
            <path fill="url(#welcome-c)" mask="url(#welcome-d)" d="M64-24h80v152H64z" />
          </g>
          <g transform="rotate(-51 91.324 -105.372)">
            <mask id="welcome-f" fill="#fff">
              <use href="#welcome-e" />
            </mask>
            <use fill="url(#welcome-b)" href="#welcome-e" />
            <path fill="url(#welcome-c)" mask="url(#welcome-f)" d="M40.333-15.147h50v95h-50z" />
          </g>
        </g>
      </svg>
    </div>
    <div>
      <h1>Good day, {{ name }}</h1>
      <p>Welcome to your CodePushGo dashboard.</p>
    </div>
  </div>
</template>
