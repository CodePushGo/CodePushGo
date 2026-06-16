import { describe, expect, it } from 'vitest'
import { withMcpToolTracking } from '../src/mcp'

describe('[Capgo parity] MCP analytics tracking', () => {
  it('tracks successful, isError, and thrown tool runs', async () => {
    const events: Array<Record<string, string | boolean | number>> = []
    const ok = withMcpToolTracking('codepushgo_list_apps', async () => ({ content: [{ text: 'ok' }] }), event => events.push(event))
    await expect(ok({})).resolves.toEqual({ content: [{ text: 'ok' }] })
    const bad = withMcpToolTracking('codepushgo_upload_bundle', async () => ({ isError: true }), event => events.push(event))
    await bad({})
    const boom = withMcpToolTracking('codepushgo_release', async () => { throw new Error('boom') }, event => events.push(event))
    await expect(boom({})).rejects.toThrow('boom')

    expect(events.map(event => event.success)).toEqual([true, false, false])
    expect(events.map(event => event.tool_name)).toEqual(['codepushgo_list_apps', 'codepushgo_upload_bundle', 'codepushgo_release'])
  })
})
