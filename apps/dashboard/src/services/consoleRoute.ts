export type ConsoleSection = 'dashboard' | 'home' | 'overview' | 'builds' | 'releases' | 'channels' | 'devices' | 'stats' | 'compatibility' | 'info' | 'access' | 'api-keys' | 'settings'

export function pathSection(pathname = window.location.pathname): ConsoleSection {
  if (pathname.includes('/apikey') || pathname.includes('/api-key'))
    return 'api-keys'
  if (pathname.includes('/setting') || pathname.includes('/plans'))
    return 'settings'
  if (pathname.includes('/access'))
    return 'access'
  if (pathname.includes('/info'))
    return 'info'
  if (pathname.includes('/channel'))
    return 'channels'
  if (pathname.includes('/device'))
    return 'devices'
  if (pathname.includes('/compatibility'))
    return 'compatibility'
  if (pathname.includes('/build'))
    return 'builds'
  if (pathname.includes('/stat') || pathname.includes('/analytic') || pathname.includes('/logs'))
    return 'stats'
  if (pathname.includes('/bundle') || pathname.includes('/release'))
    return 'releases'
  if (pathname === '/' || pathname === '/dashboard')
    return 'dashboard'
  if (pathname.includes('/app/home') || pathname === '/app/new' || pathname === '/apps')
    return 'home'
  return 'overview'
}

export function appIdFromPath(pathname = window.location.pathname) {
  const packageMatch = pathname.match(/\/app\/p\/([^/?#]+)/)
  if (packageMatch)
    return decodeURIComponent(packageMatch[1])

  const appMatch = pathname.match(/\/app\/([^/?#]+)/)
  if (!appMatch || appMatch[1] === 'home' || appMatch[1] === 'new')
    return ''

  return decodeURIComponent(appMatch[1])
}

export function appHref(appId: string, target: ConsoleSection = 'overview') {
  const encoded = encodeURIComponent(appId)
  if (target === 'releases')
    return `/app/${encoded}/bundles`
  if (target === 'channels')
    return `/app/${encoded}/channels`
  if (target === 'devices')
    return `/app/${encoded}/devices`
  if (target === 'compatibility')
    return `/app/${encoded}/compatibility`
  if (target === 'stats')
    return `/app/${encoded}/logs`
  if (target === 'builds')
    return `/app/${encoded}/builds`
  if (target === 'info')
    return `/app/${encoded}/info`
  if (target === 'access')
    return `/app/${encoded}/access`
  return `/app/${encoded}`
}

export function consoleSectionTitle(section: ConsoleSection, onboarding = false) {
  if (onboarding)
    return 'Onboarding'

  const titles: Record<ConsoleSection, string> = {
    dashboard: 'Dashboard',
    home: 'Apps',
    overview: 'Overview',
    builds: 'Builds',
    releases: 'Bundles',
    compatibility: 'Compatibility',
    channels: 'Channels',
    devices: 'Devices',
    stats: 'Logs',
    info: 'Info',
    access: 'Access',
    'api-keys': 'API keys',
    settings: 'Settings',
  }
  return titles[section]
}
