<script setup lang="ts">
import {
  BookOpen,
  ChartNoAxesColumn,
  KeyRound,
  LogOut,
  MessageCircle,
  PanelsTopLeft,
  X,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import type { Component } from 'vue'
import type { ConsoleAppRecord } from '../services/registration'
import type { ConsoleSection } from '../services/consoleRoute'

defineProps<{
  apps: ConsoleAppRecord[]
  currentSection: ConsoleSection
  selectedAppId: string
  sidebarOpen: boolean
  displayName: string
  email?: string
}>()

const emit = defineEmits<{
  closeSidebar: []
  navigate: [section: ConsoleSection, appId?: string]
  signOut: []
}>()

interface NavItem {
  label: string
  href: string
  icon: Component
  section?: ConsoleSection
  activePaths?: string[]
}

const route = useRoute()
const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: ChartNoAxesColumn, section: 'home', activePaths: ['/dashboard'] },
  { label: 'Apps', href: '/apps', icon: PanelsTopLeft, activePaths: ['/apps', '/app'] },
  { label: 'API Keys', href: '/dashboard/apikeys', icon: KeyRound, section: 'api-keys', activePaths: ['/dashboard/apikeys', '/apikeys'] },
]

const normalizedPath = computed(() => route.path.replace(/\/$/, '') || '/')

function isActive(item: NavItem) {
  return item.activePaths?.some((path) => {
    const normalized = path.replace(/\/$/, '') || '/'
    return normalizedPath.value === normalized || normalizedPath.value.startsWith(`${normalized}/`)
  }) ?? false
}

function openItem(item: NavItem) {
  if (item.section) {
    emit('navigate', item.section)
    return
  }
  emit('closeSidebar')
}
</script>

<template>
  <div class="sidebar-backdrop" :class="{ visible: sidebarOpen }" aria-hidden="true" @click="emit('closeSidebar')" />

  <aside id="sidebar" class="capgo-sidebar" :class="{ open: sidebarOpen }" aria-label="Console navigation">
    <div class="sidebar-header safe-zone">
      <button class="sidebar-close" type="button" aria-controls="sidebar" :aria-expanded="sidebarOpen" @click.stop="emit('closeSidebar')">
        <span class="sr-only">Close sidebar</span>
        <X :size="18" />
      </button>

      <a class="sidebar-logo" href="/dashboard" aria-label="CodePushGo console" @click.prevent="emit('navigate', 'home')">
        <img src="/favicon.svg" alt="CodePushGo logo">
        <span>CodePushGo</span>
      </a>
    </div>

    <nav class="sidebar-nav" aria-label="Pages">
      <h3>
        <span aria-hidden="true">...</span>
        <span>Pages</span>
      </h3>
      <RouterLink
        v-for="item in navItems"
        :key="item.href"
        :to="item.href"
        :class="{ active: isActive(item) }"
        @click="openItem(item)"
      >
        <component :is="item.icon" :size="22" />
        <span>{{ item.label }}</span>
      </RouterLink>
      <a href="https://codepushgo.com/docs/" target="_blank" rel="noopener">
        <BookOpen :size="22" />
        <span>Documentation</span>
      </a>
      <a href="https://discord.gg/codepushgo" target="_blank" rel="noopener">
        <MessageCircle :size="22" />
        <span>Discord</span>
      </a>
    </nav>

    <div class="sidebar-account">
      <p>Signed in</p>
      <strong>{{ displayName }}</strong>
      <small>{{ email }}</small>
      <button type="button" @click="emit('signOut')">
        <LogOut :size="16" />
        Sign out
      </button>
    </div>
  </aside>
</template>
