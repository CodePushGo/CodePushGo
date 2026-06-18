import type { Component } from 'vue'
import { AlertTriangle, ChartNoAxesColumn, Info, KeyRound, Layers3, RadioTower, Settings, ShieldCheck, Smartphone, User, Users, Webhook } from 'lucide-vue-next'

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
  { label: 'Compatibility', key: '/compatibility', icon: AlertTriangle },
  { label: 'Info', key: '/info', icon: Info },
  { label: 'Access', key: '/access', icon: ShieldCheck },
]

export const settingsTabs: ConsoleTab[] = [
  { label: 'Account', key: '/settings/account', icon: User },
  { label: 'Organization', key: '/settings/organization', icon: Users },
]

export const organizationTabs: ConsoleTab[] = [
  { label: 'General', key: '/settings/organization', icon: Settings },
  { label: 'Plans', key: '/settings/organization/plans', icon: KeyRound },
  { label: 'Members', key: '/settings/organization/members', icon: Users },
  { label: 'Webhooks', key: '/settings/organization/webhooks', icon: Webhook },
]

export const accountTabs: ConsoleTab[] = [
  { label: 'Profile', key: '/settings/account', icon: User },
]
