<script setup lang="ts">
import { Menu, RefreshCw, UploadCloud } from 'lucide-vue-next'

defineProps<{
  sidebarOpen: boolean
  pending: boolean
  loading: boolean
  title: string
  eyebrow: string
}>()

const emit = defineEmits<{
  toggleSidebar: []
  refresh: []
  upload: []
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

    <button type="button" :disabled="pending || loading" @click="emit('refresh')">
      <RefreshCw :size="16" />
      Refresh
    </button>
    <button class="primary" type="button" @click="emit('upload')">
      <UploadCloud :size="16" />
      Upload
    </button>
  </header>
</template>
