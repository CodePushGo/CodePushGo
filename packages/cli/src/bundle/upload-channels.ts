export function parseUploadChannels(value: string | undefined | null): string[] {
  if (!value)
    return []
  return [...new Set(value.split(',').map(channel => channel.trim()).filter(Boolean))]
}

export function formatUploadChannels(channels: string[]): string {
  return channels.join(', ')
}

export function getChannelsToAssignByChecksum(channels: string[], checksum: string, currentChecksums: Map<string, string | null | undefined>) {
  const channelsAlreadyCurrent: string[] = []
  const channelsToAssign: string[] = []

  for (const channel of channels) {
    if (currentChecksums.get(channel) === checksum)
      channelsAlreadyCurrent.push(channel)
    else
      channelsToAssign.push(channel)
  }

  return { channelsAlreadyCurrent, channelsToAssign }
}
