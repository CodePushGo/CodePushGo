import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { testApp } from './helpers'

import { readRootMigrations } from './helpers/migration-sql'

const migrationSql = readRootMigrations()

const inviteToken = 'secret-invite-token'
const password = 'Password1!'
const captchaToken = 'captcha-secret'

async function seedInvitation(storage: ReturnType<typeof testApp>['storage']) {
  return storage.createPendingInvitation({
    inviteMagicString: inviteToken,
    email: 'invitee@example.com',
    firstName: 'Invited',
    lastName: 'User',
    futureUuid: randomUUID(),
    orgId: 'org-test',
    role: 'read',
  })
}

describe('[Capgo parity] accept invitation logging', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redacts invitation bearer token from raw and validated body logs', async () => {
    const { app, env, storage } = testApp()
    const invitation = await seedInvitation(storage)
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const response = await app.request('https://api.test/private/accept_invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        password,
        magic_invite_string: inviteToken,
        opt_for_newsletters: false,
        captchaToken,
      }),
    }, env)

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', user_id: invitation.futureUuid, org_id: 'org-test' })

    const rawBodyLog = logSpy.mock.calls.find(([entry]) => (entry as { context?: string }).context === 'accept_invitation raw body')?.[0] as { rawBody?: unknown } | undefined
    const validatedBodyLog = logSpy.mock.calls.find(([entry]) => (entry as { context?: string }).context === 'accept_invitation validated body')?.[0] as { body?: unknown } | undefined

    expect(rawBodyLog?.rawBody).toEqual({ opt_for_newsletters: false })
    expect(validatedBodyLog?.body).toEqual({ opt_for_newsletters: false })
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(inviteToken)
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(password)
    expect(JSON.stringify(logSpy.mock.calls)).not.toContain(captchaToken)
  })

  it('accepts the invitation by creating user membership and deleting the tmp user invite', async () => {
    const { app, env, storage } = testApp()
    const invitation = await seedInvitation(storage)
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const response = await app.request('https://api.test/private/accept_invitation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password, magic_invite_string: inviteToken, opt_for_newsletters: true }),
    }, env)

    expect(response.status).toBe(200)
    await expect(storage.getUser(invitation.futureUuid)).resolves.toMatchObject({ email: 'invitee@example.com', firstName: 'Invited', lastName: 'User' })
    await expect(storage.getOrgMembership(invitation.futureUuid, 'org-test')).resolves.toMatchObject({ role: 'read' })
    await expect(storage.getPendingInvitation(inviteToken)).resolves.toBeUndefined()
  })

  it('keeps Capgo invite persistence in the single Supabase migration', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.tmp_users')
    expect(migrationSql).toContain('invite_magic_string TEXT PRIMARY KEY')
    expect(migrationSql).toContain('created_via_invite BOOLEAN NOT NULL DEFAULT false')
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tmp_users TO service_role')
  })
})
