import { describe, expect, it } from 'vitest'
import { mcpTools } from '../src/mcp'

describe('[Capgo parity] MCP tool registry', () => {
  it('exposes CodePushGo app, upload, channel, and stats tools', () => {
    expect(new Set(mcpTools.map(tool => tool.name))).toEqual(new Set([
      'codepushgo_list_apps',
      'codepushgo_upload_bundle',
      'codepushgo_update_channel',
      'codepushgo_get_stats',
    ]))
  })
})
