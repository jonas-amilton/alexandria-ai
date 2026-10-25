import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'

import type { McpServerConfig, McpToolDefinition } from '../../shared/mcp'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcNotification {
  jsonrpc: '2.0'
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id: number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export class McpClient {
  private process: ChildProcessWithoutNullStreams | null = null
  private nextId = 1
  private pendingRequests = new Map<
    number,
    { resolve: (val: unknown) => void; reject: (err: Error) => void }
  >()
  private isConnected = false
  private connectionError: string | null = null
  private tools: McpToolDefinition[] = []

  constructor(
    public readonly name: string,
    public readonly config: McpServerConfig,
    private readonly cwd: string
  ) {}

  public get connected(): boolean {
    return this.isConnected
  }

  public get error(): string | null {
    return this.connectionError
  }

  public get availableTools(): McpToolDefinition[] {
    return this.tools
  }

  public async start(): Promise<void> {
    try {
      const env = { ...process.env, ...this.config.env }
      this.process = spawn(this.config.command, this.config.args ?? [], {
        cwd: this.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      const rl = createInterface({
        input: this.process.stdout,
        crlfDelay: Infinity
      })

      rl.on('line', (line) => {
        this.handleMessage(line)
      })

      this.process.stderr.on('data', () => {
        // stderr is used for logging in MCP servers
      })

      this.process.on('error', (err) => {
        this.connectionError = err.message
        this.isConnected = false
      })

      this.process.on('exit', () => {
        this.isConnected = false
      })

      // Perform MCP initialization handshake
      await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'alexandria-ai',
          version: '1.0.0'
        }
      })

      this.sendNotification('notifications/initialized', {})

      // Fetch list of tools
      const toolsResponse = (await this.sendRequest('tools/list', {})) as {
        tools?: McpToolDefinition[]
      }

      this.tools = toolsResponse?.tools ?? []
      this.isConnected = true
      this.connectionError = null
    } catch (err) {
      this.isConnected = false
      this.connectionError = String(err)
      this.stop()
    }
  }

  public async callTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    if (!this.isConnected || !this.process) {
      throw new Error(`MCP Server '${this.name}' is not connected.`)
    }

    const response = (await this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    })) as {
      content?: Array<{ type: string; text?: string }>
      isError?: boolean
    }

    if (response?.isError) {
      const errText =
        response.content?.map((c) => c.text ?? '').join('\n') || 'MCP tool execution error'
      throw new Error(errText)
    }

    const output = response?.content?.map((c) => c.text ?? '').join('\n') || ''
    return output
  }

  public stop(): void {
    if (this.process) {
      try {
        this.process.kill()
      } catch {
        // ignore
      }
      this.process = null
    }
    this.isConnected = false
    this.pendingRequests.clear()
  }

  private sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process) {
        return reject(new Error('Process not running'))
      }

      const id = this.nextId++
      const req: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }

      this.pendingRequests.set(id, { resolve, reject })
      this.process.stdin.write(JSON.stringify(req) + '\n')
    })
  }

  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.process) return
    const notif: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params
    }
    this.process.stdin.write(JSON.stringify(notif) + '\n')
  }

  private handleMessage(line: string): void {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) return

    try {
      const msg = JSON.parse(trimmed) as JsonRpcResponse
      if (typeof msg.id === 'number' && this.pendingRequests.has(msg.id)) {
        const handler = this.pendingRequests.get(msg.id)!
        this.pendingRequests.delete(msg.id)

        if (msg.error) {
          handler.reject(new Error(msg.error.message))
        } else {
          handler.resolve(msg.result)
        }
      }
    } catch {
      // ignore malformed lines
    }
  }
}
