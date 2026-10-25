import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { join } from 'path'

import type { ToolDefinition } from '../chat-completions'
import type { McpConfigFile, McpServerStatus } from '../../shared/mcp'
import { McpClient } from './client'

const MCP_FILE = 'mcp.json'
const ALEXANDRIA_DIR = '.alexandria'

class McpManager {
  private clients = new Map<string, McpClient>()
  private currentProjectPath: string | null = null

  public async loadForProject(projectPath: string): Promise<void> {
    if (this.currentProjectPath === projectPath) {
      return
    }

    this.stopAll()
    this.currentProjectPath = projectPath

    const configPath = join(projectPath, ALEXANDRIA_DIR, MCP_FILE)
    if (!existsSync(configPath)) {
      return
    }

    try {
      const raw = await readFile(configPath, 'utf-8')
      // strip single-line comments in case user wrote comments in JSON
      const cleanJson = raw.replace(/\/\/.*/g, '')
      const config = JSON.parse(cleanJson) as McpConfigFile

      if (config.mcpServers) {
        for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
          if (serverConfig && typeof serverConfig.command === 'string') {
            const client = new McpClient(name, serverConfig, projectPath)
            this.clients.set(name, client)
            // Start client in background
            void client.start()
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  public getStatuses(): McpServerStatus[] {
    const statuses: McpServerStatus[] = []
    for (const client of this.clients.values()) {
      statuses.push({
        name: client.name,
        command: `${client.config.command} ${(client.config.args ?? []).join(' ')}`.trim(),
        connected: client.connected,
        error: client.error ?? undefined,
        tools: client.availableTools
      })
    }
    return statuses
  }

  public getToolDefinitions(): ToolDefinition[] {
    const toolDefs: ToolDefinition[] = []

    for (const client of this.clients.values()) {
      if (!client.connected) continue

      for (const tool of client.availableTools) {
        const wireName = `mcp__${client.name}__${tool.name}`
        toolDefs.push({
          type: 'function',
          function: {
            name: wireName,
            description: `[MCP: ${client.name}] ${tool.description ?? tool.name}`,
            parameters: tool.inputSchema ?? { type: 'object', properties: {} }
          }
        })
      }
    }

    return toolDefs
  }

  public isMcpTool(fullName: string): boolean {
    return fullName.startsWith('mcp__')
  }

  public async executeTool(fullName: string, args: Record<string, unknown>): Promise<string> {
    const parts = fullName.split('__')
    if (parts.length < 3) {
      throw new Error(`Nome de ferramenta MCP inválido: ${fullName}`)
    }

    const serverName = parts[1]
    const toolName = parts.slice(2).join('__')

    const client = this.clients.get(serverName)
    if (!client) {
      throw new Error(`Servidor MCP '${serverName}' não encontrado ou inativo.`)
    }

    return await client.callTool(toolName, args)
  }

  public stopAll(): void {
    for (const client of this.clients.values()) {
      client.stop()
    }
    this.clients.clear()
    this.currentProjectPath = null
  }
}

export const mcpManager = new McpManager()
