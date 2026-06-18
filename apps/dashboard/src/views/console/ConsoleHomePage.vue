<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import TopApps from '../../components/dashboard/TopApps.vue'
import WelcomeBanner from '../../components/dashboard/WelcomeBanner.vue'
import { useConsoleStore } from '../../stores/console'

const {
  apps,
  copyCommand,
  displayName,
  firstName,
  initCommand,
  navigate,
  selectedAppId,
} = useConsoleStore()
</script>

<template>
  <section class="dashboard-content">
    <WelcomeBanner :name="firstName || displayName" />
    <div class="dashboard-home-grid">
      <TopApps :apps="apps" :selected-app-id="selectedAppId" @open-app="navigate('overview', $event)" />
      <article class="quickstart-card">
        <p class="eyebrow">Add app</p>
        <h2>Let the CLI detect the bundle ID</h2>
        <button class="command" type="button" @click="copyCommand(initCommand)">
          <code>{{ initCommand }}</code>
          <Copy :size="16" />
        </button>
        <p>Do not create a separate CodePushGo identifier. The app id is the React Native native bundle ID.</p>
      </article>
    </div>
  </section>
</template>
