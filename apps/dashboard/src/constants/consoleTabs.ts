import type { Component } from 'vue'
import { ChartNoAxesColumn, KeyRound, Layers3, RadioTower, Settings, Smartphone, User, Users } from 'lucide-vue-next'

export interface ConsoleTab {
  label: string
  key: string
  icon: Component
}

export const appTabs: ConsoleTab[] = [
  { label: 'Overview', key: '', icon: ChartNoAxesColumn },
  { label: 'Bundles', key: '/bundles', icon: Layers3 },
  { label: 'Channels', key: '/channels', icon: RadioTower },
  { label: 'Devices', key: '/devices', icon: Smartphone },
  { label: 'Logs', key: '/logs', icon: ChartNoAxesColumn },
]

export const settingsTabs: ConsoleTab[] = [
  { label: 'Account', key: '/settings/account', icon: User },
  { label: 'Organization', key: '/settings/organization', icon: Users },
]

export const organizationTabs: ConsoleTab[] = [
  { label: 'General', key: '/settings/organization', icon: Settings },
  { label: 'Plans', key: '/settings/organization/plans', icon: KeyRound },
  { label: 'Members', key: '/settings/organization/members', icon: Users },
]

export const accountTabs: ConsoleTab[] = [
  { label: 'Profile', key: '/settings/account', icon: User },
]
