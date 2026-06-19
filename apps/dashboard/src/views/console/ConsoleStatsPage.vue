<script setup lang="ts">
import LogTable from '../../components/tables/LogTable.vue'
import { useConsoleStore } from '../../stores/console'

const { appStats } = useConsoleStore()
</script>

<template>
  <section class="dashboard-content">
    <LogTable :app-stats="appStats" />
  </section>
</template>
