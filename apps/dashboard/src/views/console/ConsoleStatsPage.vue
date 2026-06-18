<script setup lang="ts">
import { Activity } from 'lucide-vue-next'
import LogTable from '../../components/tables/LogTable.vue'
import { useConsoleStore } from '../../stores/console'

const { appStats } = useConsoleStore()
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <h2>Stats</h2>
      <Activity :size="18" />
    </header>
    <LogTable :app-stats="appStats" />
  </section>
</template>
