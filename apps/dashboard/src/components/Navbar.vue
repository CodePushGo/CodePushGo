<script setup lang="ts">
import { Menu } from 'lucide-vue-next'

defineProps<{
  sidebarOpen: boolean
  title: string
  eyebrow: string
}>()

const emit = defineEmits<{
  toggleSidebar: []
}>()
</script>

<template>
  <header class="console-navbar">
    <button class="menu-button" type="button" aria-controls="sidebar" :aria-expanded="sidebarOpen" @click.stop="emit('toggleSidebar')">
      <span class="sr-only">Open sidebar</span>
      <Menu :size="20" />
    </button>

    <div class="breadcrumb">
      <span>{{ eyebrow }}</span>
      <strong>{{ title }}</strong>
    </div>

    <div class="navbar-spacer" />
  </header>
</template>
