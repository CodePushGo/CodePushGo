<script setup lang="ts">
import BundleTable from '../../components/tables/BundleTable.vue'
import type { ConsoleReleaseRecord } from '../../services/registration'
import { useConsoleStore } from '../../stores/console'

const {
  copyCommand,
  releases,
  selectedAppId,
} = useConsoleStore()

function copyBundle(release: ConsoleReleaseRecord) {
  void copyCommand(`${release.platform}:${release.channel}:${release.version}`)
}
</script>

<template>
  <section class="dashboard-content">
    <BundleTable :app-id="selectedAppId" :releases="releases" @copy-bundle="copyBundle" />
  </section>
</template>
