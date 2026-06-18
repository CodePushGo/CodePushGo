<script setup lang="ts">
import { Smartphone } from 'lucide-vue-next'
import DeviceTable from '../../components/tables/DeviceTable.vue'
import { useConsoleStore } from '../../stores/console'

const { devices } = useConsoleStore()
</script>

<template>
  <section class="dashboard-content console-table-card">
    <header>
      <h2>Devices</h2>
      <Smartphone :size="18" />
    </header>
    <DeviceTable :devices="devices" />
  </section>
</template>
