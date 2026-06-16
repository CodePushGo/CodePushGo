export interface CliEventPayload {
  channel: string
  event: string
  icon?: string
  notify?: boolean
  notify_console?: boolean
  org_id?: string
  tracking_version?: number
  tags?: Record<string, string>
}

export async function sendEvent(apikey: string, payload: CliEventPayload) {
  const endpoint = process.env.CODEPUSHGO_API_URL ?? 'https://api.codepushgo.com'
  await fetch(`${endpoint.replace(/\/$/, '')}/private/events`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apikey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

export function canPromptInteractively(input: { stdinIsTTY?: boolean, stdoutIsTTY?: boolean, ci?: boolean, silent?: boolean } = {}) {
  if (input.silent)
    return false
  if (input.ci ?? process.env.CI === 'true')
    return false
  const stdinIsTTY = input.stdinIsTTY ?? process.stdin.isTTY
  const stdoutIsTTY = input.stdoutIsTTY ?? process.stdout.isTTY
  return !!stdinIsTTY && !!stdoutIsTTY
}
