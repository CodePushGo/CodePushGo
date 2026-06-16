export interface ChannelPromotionTarget {
  id: number
  name: string
}

export interface ChannelPromotionScope {
  appId: string
  channelId: number
}

export type ChannelPermissionChecker = (permission: 'write' | 'promote', scope: ChannelPromotionScope) => boolean | Promise<boolean>

export async function findChannelsWithoutPromotionPermission(
  appId: string,
  channels: ChannelPromotionTarget[],
  can: ChannelPermissionChecker,
) {
  const denied: ChannelPromotionTarget[] = []
  for (const channel of channels) {
    try {
      if (!await can('promote', { appId, channelId: channel.id }))
        denied.push(channel)
    }
    catch {
      denied.push(channel)
    }
  }
  return denied
}

export function formatChannelPromotionTargets(channels: ChannelPromotionTarget[]) {
  return channels.map(channel => channel.name).join(', ')
}
