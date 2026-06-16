import { describe, expect, it, vi } from 'vitest'
import { executeStatsQueryWithRetry, getMissingAppStatsError, resolveAppOwnerOrgFromRows } from '../src/statistics-retries'

describe('[Capgo parity] statistics retry helpers', () => {
  it('retries transient statistics query failures and returns the recovered result', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'error code: 502' }, status: 502 })
      .mockResolvedValueOnce({ data: [{ app_id: 'com.demo.app' }], error: null, status: 200 })

    const result = await executeStatsQueryWithRetry(query)

    expect(result).toEqual({ data: [{ app_id: 'com.demo.app' }], error: null, status: 200 })
    expect(query).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable statistics query failures', async () => {
    const query = vi.fn().mockResolvedValue({ data: null, error: { message: 'bad request' }, status: 400 })

    const result = await executeStatsQueryWithRetry(query)

    expect(result).toEqual({ data: null, error: { message: 'bad request' }, status: 400 })
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('marks missing apps as not found when the lookup returns no rows', () => {
    expect(resolveAppOwnerOrgFromRows([])).toEqual({ ownerOrg: null, error: null, notFound: true })
  })

  it('detects missing-app errors in aggregated statistics results', () => {
    expect(getMissingAppStatsError([{ error: 'cannot_get_user_statistics', status: 500 }, { error: 'app_not_found', status: 404 }])).toEqual({ error: 'app_not_found', status: 404 })
  })

  it('ignores unrelated 404 errors when looking for missing apps', () => {
    expect(getMissingAppStatsError([{ error: 'rpc_not_found', status: 404 }])).toBeUndefined()
  })
})
