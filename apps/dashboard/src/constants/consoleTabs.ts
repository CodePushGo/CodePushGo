import type { Component } from 'vue'
import { AlertTriangle, Bell, ChartNoAxesColumn, CreditCard, FileClock, Hammer, Info, KeyRound, Layers3, LockKeyhole, RadioTower, Settings, ShieldCheck, Smartphone, User, Users, Webhook } from 'lucide-vue-next'

export interface ConsoleTab {
  label: string
  key: string
  icon: Component
}

export const appTabs: ConsoleTab[] = [
  { label: 'Overview', key: '', icon: ChartNoAxesColumn },
  { label: 'Info', key: '/info', icon: Info },
  { label: 'Bundles', key: '/bundles', icon: Layers3 },
  { label: 'Channels', key: '/channels', icon: RadioTower },
  { label: 'Devices', key: '/devices', icon: Smartphone },
  { label: 'Logs', key: '/logs', icon: ChartNoAxesColumn },
  { label: 'Compatibility', key: '/compatibility', icon: AlertTriangle },
  { label: 'Builds', key: '/builds', icon: Hammer },
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
  { label: 'Groups', key: '/settings/organization/groups', icon: Users },
  { label: 'Webhooks', key: '/settings/organization/webhooks', icon: Webhook },
  { label: 'Credits', key: '/settings/organization/credits', icon: CreditCard },
  { label: 'Security', key: '/settings/organization/security', icon: ShieldCheck },
  { label: 'Usage', key: '/settings/organization/usage', icon: ChartNoAxesColumn },
  { label: 'Audit logs', key: '/settings/organization/auditlogs', icon: FileClock },
]

export const accountTabs: ConsoleTab[] = [
  { label: 'Profile', key: '/settings/account', icon: User },
  { label: 'Notifications', key: '/settings/account/notifications', icon: Bell },
  { label: 'Change password', key: '/settings/account/change-password', icon: LockKeyhole },
  { label: 'Manage 2FA', key: '/settings/account/manage-2fa', icon: ShieldCheck },
]
