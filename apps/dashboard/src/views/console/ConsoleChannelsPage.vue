<script setup lang="ts">
import { RadioTower } from 'lucide-vue-next'
import ChannelTable from '../../components/tables/ChannelTable.vue'
import { useConsoleStore } from '../../stores/console'

const { channels, selectedAppId } = useConsoleStore()
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <h2>Channels</h2>
      <RadioTower :size="18" />
    </header>
    <ChannelTable :app-id="selectedAppId" :channels="channels" />
  </section>
</template>
