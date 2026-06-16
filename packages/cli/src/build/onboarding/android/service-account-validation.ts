import { Buffer } from 'node:buffer'

export interface ServiceAccountKey {
  type: 'service_account'
  client_email: string
  private_key: string
  project_id: string
  token_uri: string
  private_key_id?: string
}

export type ServiceAccountValidationResult =
  | { ok: true, clientEmail: string, projectId: string }
  | { ok: false, kind: 'shape-error' | 'token-error' | 'permission-error' | 'network-error', message: string }

function requiredString(record: Record<string, unknown>, field: string) {
  const value = record[field]
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error(`service account key is missing required field "${field}"`)
  return value
}

export function parseServiceAccountKey(jsonBytes: Buffer | Uint8Array | string): ServiceAccountKey {
  let parsed: unknown
  try {
    const text = typeof jsonBytes === 'string' ? jsonBytes : Buffer.from(jsonBytes).toString('utf8')
    parsed = JSON.parse(text)
  }
  catch {
    throw new Error('service account key is not valid JSON')
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new Error('service account key must be a JSON object')

  const record = parsed as Record<string, unknown>
  if (record.type !== 'service_account')
    throw new Error('JSON key is not a service account key')

  const tokenUri = requiredString(record, 'token_uri')
  if (tokenUri !== 'https://oauth2.googleapis.com/token')
    throw new Error(`unsupported token_uri "${tokenUri}"`)

  return {
    type: 'service_account',
    client_email: requiredString(record, 'client_email'),
    private_key: requiredString(record, 'private_key'),
    project_id: requiredString(record, 'project_id'),
    token_uri: tokenUri,
    ...(typeof record.private_key_id === 'string' ? { private_key_id: record.private_key_id } : {}),
  }
}

async function readJson(response: Response) {
  try {
    return await response.json() as Record<string, unknown>
  }
  catch {
    return null
  }
}

function responseMessage(prefix: string, response: Response, body: Record<string, unknown> | null) {
  const description = typeof body?.error_description === 'string' ? body.error_description : typeof body?.error === 'string' ? body.error : response.statusText
  return `${prefix}: ${description || response.status}`
}

export async function validateServiceAccountJson(input: { jsonBytes: Buffer | Uint8Array | string, packageName: string, fetchImpl?: typeof fetch }): Promise<ServiceAccountValidationResult> {
  let key: ServiceAccountKey
  try {
    key = parseServiceAccountKey(input.jsonBytes)
  }
  catch (error) {
    return { ok: false, kind: 'shape-error', message: error instanceof Error ? error.message : String(error) }
  }

  const fetchImpl = input.fetchImpl ?? fetch
  let tokenBody: Record<string, unknown> | null = null
  let tokenResponse: Response
  try {
    tokenResponse = await fetchImpl(key.token_uri, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: key.client_email }),
    })
    tokenBody = await readJson(tokenResponse)
  }
  catch (error) {
    return { ok: false, kind: 'network-error', message: error instanceof Error ? error.message : String(error) }
  }

  if (tokenResponse.status === 401 || tokenResponse.status === 403)
    return { ok: false, kind: 'token-error', message: responseMessage('Token exchange failed', tokenResponse, tokenBody) }
  if (!tokenResponse.ok || !tokenBody || typeof tokenBody.access_token !== 'string')
    return { ok: false, kind: 'network-error', message: responseMessage('Token exchange failed', tokenResponse, tokenBody) }

  const editUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(input.packageName)}/edits`
  let editResponse: Response
  let editBody: Record<string, unknown> | null = null
  try {
    editResponse = await fetchImpl(editUrl, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenBody.access_token}` },
    })
    editBody = await readJson(editResponse)
  }
  catch (error) {
    return { ok: false, kind: 'network-error', message: error instanceof Error ? error.message : String(error) }
  }

  if (editResponse.status === 401 || editResponse.status === 403 || editResponse.status === 404)
    return { ok: false, kind: 'permission-error', message: responseMessage('Google Play edit check failed', editResponse, editBody) }
  if (!editResponse.ok || !editBody || typeof editBody.id !== 'string')
    return { ok: false, kind: 'network-error', message: responseMessage('Google Play edit check failed', editResponse, editBody) }

  await fetchImpl(`${editUrl}/${encodeURIComponent(editBody.id)}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${tokenBody.access_token}` },
  }).catch(() => undefined)

  return { ok: true, clientEmail: key.client_email, projectId: key.project_id }
}
