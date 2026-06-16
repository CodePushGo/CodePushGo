import { describe, expect, it } from 'vitest'
import { createWorkerApp, MemoryStorage, type Env } from '../src/index'

const env: Env = { CODEPUSHGO_API_KEY: 'test-token' }

describe('[Capgo parity] private RBAC auth ordering', () => {
  it.concurrent('returns 401 before validating invalid group params', async () => {
    const response = await request('/private/groups/not-a-uuid')
    expect(response.status).toBe(401)
  })

  it.concurrent('returns 401 before validating invalid group-member bodies', async () => {
    const response = await request('/private/groups/550e8400-e29b-41d4-a716-446655440000/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: 'not-a-uuid' }),
    })
    expect(response.status).toBe(401)
  })

  it.concurrent('returns 401 before validating invalid role binding params', async () => {
    const response = await request('/private/role_bindings/not-a-uuid')
    expect(response.status).toBe(401)
  })

  it.concurrent('returns 401 before validating invalid role binding bodies', async () => {
    const response = await request('/private/role_bindings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        principal_type: 'device',
        principal_id: 'not-a-uuid',
        role_name: '',
        scope_type: 'invalid',
        org_id: 'not-a-uuid',
      }),
    })
    expect(response.status).toBe(401)
  })

  it.concurrent('returns 401 before validating invalid role scope params', async () => {
    const response = await request('/private/roles/not-a-scope')
    expect(response.status).toBe(401)
  })
})

function request(path: string, init?: RequestInit) {
  const app = createWorkerApp(() => new MemoryStorage())
  return app.request(`http://localhost${path}`, init, env)
}
