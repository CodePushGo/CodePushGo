import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearReplicationLagCache, setReplicationLagHeader } from '../src/replication-lag-cache'

function makeContext(databaseSource: string) {
  const headers = new Headers()
  return {
    context: {
      get: (key: string) => key === 'databaseSource' ? databaseSource : undefined,
      header: (name: string, value: string) => headers.set(name, value),
    },
    headers,
  }
}

describe('[Capgo parity] replication lag header cache', () => {
  afterEach(() => {
    clearReplicationLagCache()
    vi.useRealTimers()
  })

  it('reuses replication lag for one minute before querying again', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'))
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ lag_seconds: '12.4' }] })
        .mockResolvedValueOnce({ rows: [{ lag_seconds: '25.1' }] }),
    }
    const source = `replica-cache-${crypto.randomUUID()}`

    const first = makeContext(source)
    await setReplicationLagHeader(first.context, pool)
    expect(first.headers.get('X-Replication-Lag')).toBe('ok')
    expect(first.headers.get('X-Replication-Lag-Seconds')).toBe('12')

    const second = makeContext(source)
    await setReplicationLagHeader(second.context, pool)
    expect(second.headers.get('X-Replication-Lag-Seconds')).toBe('12')
    expect(pool.query).toHaveBeenCalledTimes(1)

    vi.setSystemTime(new Date('2026-05-01T12:01:01Z'))
    const third = makeContext(source)
    await setReplicationLagHeader(third.context, pool)
    expect(third.headers.get('X-Replication-Lag-Seconds')).toBe('25')
    expect(pool.query).toHaveBeenCalledTimes(2)
  })

  it('emits cached zero-second lag values', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-01T12:00:00Z'))
    const pool = { query: vi.fn().mockResolvedValue({ rows: [{ lag_seconds: '0' }] }) }
    const source = `replica-zero-${crypto.randomUUID()}`

    const first = makeContext(source)
    await setReplicationLagHeader(first.context, pool)
    expect(first.headers.get('X-Replication-Lag')).toBe('ok')
    expect(first.headers.get('X-Replication-Lag-Seconds')).toBe('0')

    const second = makeContext(source)
    await setReplicationLagHeader(second.context, pool)
    expect(second.headers.get('X-Replication-Lag-Seconds')).toBe('0')
    expect(pool.query).toHaveBeenCalledTimes(1)
  })
})
