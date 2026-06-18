<script setup lang="ts">
import { UploadCloud } from 'lucide-vue-next'
import BundleTable from '../../components/tables/BundleTable.vue'
import { useConsoleStore } from '../../stores/console'

const {
  copyCommand,
  releases,
  uploadCommand,
} = useConsoleStore()
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <h2>Bundles</h2>
      <button type="button" @click="copyCommand(uploadCommand)"><UploadCloud :size="16" /> Upload command</button>
    </header>
    <BundleTable :releases="releases" />
  </section>
</template>
