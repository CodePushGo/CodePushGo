<script setup lang="ts">
import ChannelTable from '../../components/tables/ChannelTable.vue'
import { useConsoleStore } from '../../stores/console'

const { channels, selectedAppId } = useConsoleStore()
</script>

<template>
  <section class="dashboard-content">
    <ChannelTable :app-id="selectedAppId" :channels="channels" />
  </section>
</template>
