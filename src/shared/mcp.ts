export interface McpServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpConfigFile {
  mcpServers?: Record<string, McpServerConfig>
}

export interface McpToolDefinition {
  name: string
  description?: string
  inputSchema?: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

export interface McpServerStatus {
  name: string
  command: string
  connected: boolean
  error?: string
  tools: McpToolDefinition[]
}
