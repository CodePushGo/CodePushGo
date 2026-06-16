import type { Context } from 'hono'

export interface ValidationIssue {
  message: string
  path: PropertyKey[]
  code?: string
}
export interface StandardSchema<_T> {
  '~standard': {
    validate: (value: unknown) => { value: _T } | { issues: ValidationIssue[] }
  }
}

type ValidationIssues = readonly ValidationIssue[]
type ValidationResult<_T> = { success: true } | { success: false, error: ValidationIssues }

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const roleScopes = new Set(['org', 'app', 'channel'])
const principalTypes = new Set(['user', 'group', 'apikey'])
const jsonContentTypeRegex = /^application\/(?:[a-z-.]+\+)?json(?:;\s*[a-zA-Z0-9-]+=[^;]+)*$/

function issue(field: string, code = 'invalid_type', message = 'Invalid value'): ValidationIssue {
  return { path: [field], code, message }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function firstIssueField(issues: ValidationIssues): string | undefined {
  const field = issues[0]?.path?.[0]
  return typeof field === 'string' ? field : undefined
}

function issueField(entry: ValidationIssue): string | undefined {
  const field = entry.path?.[0]
  return typeof field === 'string' ? field : undefined
}

function hasRequiredIssue(issues: ValidationIssues, field: string) {
  return issues.some(entry => entry.code === 'required' && issueField(entry) === field)
}

function hasRequiredValueIssue(issues: ValidationIssues, field: string) {
  return issues.some(entry => ['required', 'minLength'].includes(entry.code ?? '') && issueField(entry) === field)
}

function hasIssueForField(issues: ValidationIssues, field: string) {
  return issues.some(entry => issueField(entry) === field)
}

function createErrorHook(resolveMessage: (issues: ValidationIssues) => string) {
  return (result: ValidationResult<unknown>, c: Context) => {
    if (result.success)
      return undefined
    return c.json({ error: resolveMessage(result.error) }, 400)
  }
}

function createSchema<T>(validate: (value: unknown) => ValidationIssue[]): StandardSchema<T> {
  return {
    '~standard': {
      validate(value) {
        const issues = validate(value)
        return issues.length ? { issues } : { value: value as T }
      },
    },
  }
}

function validateUuidObject(field: string) {
  return createSchema<Record<string, string>>((value) => {
    if (!isRecord(value) || typeof value[field] !== 'string' || !uuidRegex.test(value[field]))
      return [issue(field)]
    return []
  })
}

export async function validateJsonBody<T>(
  c: Context,
  schema: StandardSchema<T>,
  hook?: (result: ValidationResult<T>, c: Context) => Response | void | Promise<Response | void>,
): Promise<{ ok: true, data: T } | { ok: false, response: Response }> {
  const bodyResult = await parseJsonBodyWithHeaderFallback(c)
  if (!bodyResult.ok)
    return bodyResult

  const result = await Promise.resolve(schema['~standard'].validate(bodyResult.data))
  const parsedResult: ValidationResult<T> = 'issues' in result ? { success: false, error: result.issues } : { success: true }
  const hookResult = hook ? await hook(parsedResult, c) : undefined
  if (hookResult)
    return { ok: false, response: hookResult }

  if ('issues' in result) {
    return {
      ok: false,
      response: c.json({ data: bodyResult.data, error: result.issues, success: false }, 400),
    }
  }
  return { ok: true, data: result.value }
}

async function parseJsonBodyWithHeaderFallback(c: Context): Promise<{ ok: true, data: unknown } | { ok: false, response: Response }> {
  const contentType = c.req.header('Content-Type')
  if (contentType && jsonContentTypeRegex.test(contentType)) {
    try {
      return { ok: true, data: await c.req.json() }
    }
    catch {
      return { ok: false, response: c.json({ error: 'invalid_json_parse_body', message: 'Invalid JSON body' }, 400) }
    }
  }

  const rawBody = await c.req.raw.clone().text()
  if (!rawBody)
    return { ok: false, response: c.json({ error: 'invalid_json_parse_body', message: 'Invalid JSON body' }, 400) }
  try {
    return { ok: true, data: JSON.parse(rawBody) }
  }
  catch {
    return { ok: false, response: c.json({ error: 'invalid_json_parse_body', message: 'Invalid JSON body' }, 400) }
  }
}

export const orgIdParamSchema = validateUuidObject('org_id')
export const appIdParamSchema = validateUuidObject('app_id')
export const groupIdParamSchema = validateUuidObject('group_id')
export const bindingIdParamSchema = validateUuidObject('binding_id')

export const groupMemberParamSchema = createSchema<Record<string, string>>((value) => {
  const issues: ValidationIssue[] = []
  if (!isRecord(value) || typeof value.group_id !== 'string' || !uuidRegex.test(value.group_id))
    issues.push(issue('group_id'))
  if (!isRecord(value) || typeof value.user_id !== 'string' || !uuidRegex.test(value.user_id))
    issues.push(issue('user_id'))
  return issues
})

export const roleScopeParamSchema = createSchema<Record<string, string>>((value) => {
  if (!isRecord(value) || typeof value.scope_type !== 'string' || !roleScopes.has(value.scope_type))
    return [issue('scope_type')]
  return []
})

export const createGroupBodySchema = createSchema<Record<string, unknown>>((value) => {
  if (!isRecord(value))
    return [issue('name', 'required')]
  if (value.name === undefined || value.name === '')
    return [issue('name', value.name === '' ? 'minLength' : 'required')]
  if (typeof value.name !== 'string')
    return [issue('name')]
  if (value.description !== undefined && value.description !== null && typeof value.description !== 'string')
    return [issue('description')]
  return []
})

export const updateGroupBodySchema = createSchema<Record<string, unknown>>((value) => {
  if (!isRecord(value))
    return [issue('name')]
  if (value.name !== undefined && value.name !== null && typeof value.name !== 'string')
    return [issue('name')]
  if (value.description !== undefined && value.description !== null && typeof value.description !== 'string')
    return [issue('description')]
  return []
})

export const addGroupMemberBodySchema = createSchema<Record<string, unknown>>((value) => {
  if (!isRecord(value) || value.user_id === undefined)
    return [issue('user_id', 'required')]
  if (typeof value.user_id !== 'string' || !uuidRegex.test(value.user_id))
    return [issue('user_id')]
  return []
})

export const createRoleBindingBodySchema = createSchema<Record<string, unknown>>((value) => {
  const issues: ValidationIssue[] = []
  if (!isRecord(value))
    return [issue('principal_type', 'required')]
  for (const field of ['principal_type', 'principal_id', 'scope_type', 'org_id', 'role_name']) {
    if (value[field] === undefined)
      issues.push(issue(field, 'required'))
  }
  if (value.role_name === '')
    issues.push(issue('role_name', 'minLength'))
  if (typeof value.principal_type === 'string' && !principalTypes.has(value.principal_type))
    issues.push(issue('principal_type'))
  if (typeof value.principal_id === 'string' && !uuidRegex.test(value.principal_id))
    issues.push(issue('principal_id'))
  if (typeof value.scope_type === 'string' && !roleScopes.has(value.scope_type))
    issues.push(issue('scope_type'))
  if (typeof value.org_id === 'string' && !uuidRegex.test(value.org_id))
    issues.push(issue('org_id'))
  if (value.app_id !== undefined && value.app_id !== null && (typeof value.app_id !== 'string' || !uuidRegex.test(value.app_id)))
    issues.push(issue('app_id'))
  if (value.channel_id !== undefined && value.channel_id !== null && !isValidChannelId(value.channel_id))
    issues.push(issue('channel_id'))
  if (value.reason !== undefined && value.reason !== null && typeof value.reason !== 'string')
    issues.push(issue('reason'))
  return issues
})

export const updateRoleBindingBodySchema = createSchema<Record<string, unknown>>((value) => {
  if (!isRecord(value) || value.role_name === undefined)
    return [issue('role_name', 'required')]
  if (value.role_name === '')
    return [issue('role_name', 'minLength')]
  if (typeof value.role_name !== 'string')
    return [issue('role_name')]
  return []
})

function isValidChannelId(value: unknown) {
  if (typeof value === 'number')
    return Number.isInteger(value) && value >= 0
  return typeof value === 'string' && (uuidRegex.test(value) || /^\d+$/.test(value))
}

export const invalidOrgIdHook = createErrorHook(() => 'Invalid org_id')
export const invalidAppIdHook = createErrorHook(() => 'Invalid app_id')
export const invalidGroupIdHook = createErrorHook(() => 'Invalid group_id')
export const invalidBindingIdHook = createErrorHook(() => 'Invalid binding_id')
export const invalidScopeTypeHook = createErrorHook(() => 'Invalid scope_type')

export const invalidGroupMemberParamHook = createErrorHook((issues) => firstIssueField(issues) === 'user_id' ? 'Invalid user_id' : 'Invalid group_id')

export const createGroupBodyHook = createErrorHook((issues) => {
  if (hasRequiredValueIssue(issues, 'name'))
    return 'Name is required'
  switch (firstIssueField(issues)) {
    case 'name': return 'Invalid name'
    case 'description': return 'Invalid description'
    default: return 'Invalid request body'
  }
})

export const updateGroupBodyHook = createErrorHook((issues) => {
  switch (firstIssueField(issues)) {
    case 'name': return 'Invalid name'
    case 'description': return 'Invalid description'
    default: return 'Invalid request body'
  }
})

export const addGroupMemberBodyHook = createErrorHook((issues) => {
  if (hasRequiredIssue(issues, 'user_id'))
    return 'user_id is required'
  return firstIssueField(issues) === 'user_id' ? 'Invalid user_id' : 'Invalid request body'
})

export const createRoleBindingBodyHook = createErrorHook((issues) => {
  if (['principal_type', 'principal_id', 'scope_type', 'org_id'].some(field => hasRequiredIssue(issues, field)) || hasRequiredValueIssue(issues, 'role_name'))
    return 'Missing required fields'
  for (const [field, message] of [
    ['principal_type', 'Invalid principal_type'],
    ['principal_id', 'Invalid principal_id'],
    ['role_name', 'Invalid role_name'],
    ['scope_type', 'Invalid scope_type'],
    ['org_id', 'Invalid org_id'],
    ['app_id', 'Invalid app_id'],
    ['channel_id', 'Invalid channel_id'],
    ['reason', 'Invalid reason'],
  ] as const) {
    if (hasIssueForField(issues, field))
      return message
  }
  return 'Invalid request body'
})

export const updateRoleBindingBodyHook = createErrorHook((issues) => {
  if (hasRequiredValueIssue(issues, 'role_name'))
    return 'role_name is required'
  return firstIssueField(issues) === 'role_name' ? 'Invalid role_name' : 'Invalid request body'
})
