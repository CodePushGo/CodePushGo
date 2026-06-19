<script setup lang="ts">
import DeviceTable from '../../components/tables/DeviceTable.vue'
import { useConsoleStore } from '../../stores/console'

const { devices, selectedAppId } = useConsoleStore()
</script>

<template>
  <section class="dashboard-content">
    <DeviceTable :app-id="selectedAppId" :devices="devices" />
  </section>
</template>
