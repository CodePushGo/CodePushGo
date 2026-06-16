export interface McpToolDefinition {
  name: string
  description: string
}

export const mcpTools: McpToolDefinition[] = [
  { name: 'codepushgo_list_apps', description: 'List CodePushGo apps' },
  { name: 'codepushgo_upload_bundle', description: 'Upload a React Native bundle' },
  { name: 'codepushgo_update_channel', description: 'Update a release channel' },
  { name: 'codepushgo_get_stats', description: 'Read update statistics' },
]

export function withMcpToolTracking<TArgs, TResult>(toolName: string, handler: (args: TArgs) => Promise<TResult>, track: (event: Record<string, string | boolean | number>) => void | Promise<void>) {
  return async (args: TArgs): Promise<TResult> => {
    const started = Date.now()
    try {
      const result = await handler(args)
      const success = !(result && typeof result === 'object' && (result as { isError?: unknown }).isError === true)
      await track({ tool_name: toolName, success, duration_ms: Date.now() - started })
      return result
    }
    catch (error) {
      await track({ tool_name: toolName, success: false, duration_ms: Date.now() - started })
      throw error
    }
  }
}
