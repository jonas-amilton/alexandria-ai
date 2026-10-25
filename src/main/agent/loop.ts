import type { ProviderId } from '../../shared/providers'
import {
  streamChatCompletion,
  type WireAssistantMessage,
  type WireMessage,
  type WireToolCall
} from '../chat-completions'
import { AGENT_TOOLS, executeAgentTool, type ToolResult } from './tools'
import { mcpManager } from '../mcp/manager'

export type AgentToolEventStatus = 'running' | 'done' | 'error'

export interface AgentToolEvent {
  callId: string
  name: string
  status: AgentToolEventStatus
  detail?: string
}

export interface AgentTurnOptions {
  provider: ProviderId
  apiKey: string
  model: string
  systemPrompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  userMessage: string
  signal: AbortSignal
  maxIterations: number
  projectId?: string
  /** Development-only override used by the local mock server in tests. */
  baseUrl?: string
  onDelta: (content: string) => void
  onToolEvent: (event: AgentToolEvent) => void
  onStreamReset: () => void
}

const MAX_TOOL_RESULT_CHARS = 8000
const MAX_TOOL_DETAIL_CHARS = 120

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength - 1)}…`
}

function assistantMessage(content: string, toolCalls: WireToolCall[]): WireAssistantMessage {
  if (toolCalls.length === 0) {
    return { role: 'assistant', content }
  }

  return {
    role: 'assistant',
    content: content.length > 0 ? content : null,
    tool_calls: toolCalls
  }
}

function summarizeToolResult(result: ToolResult): string {
  const firstLine = result.content.split('\n')[0] ?? ''

  return truncate(firstLine, MAX_TOOL_DETAIL_CHARS)
}

/**
 * Minimal replica of Hermes' per-turn loop:
 *   model call -> tool calls? -> execute -> append tool results -> repeat.
 * At the iteration cap, Hermes makes one extra tool-less call so the model can
 * summarize; we do the same.
 *
 * Deliberate simplifications versus Hermes: tools run sequentially (Hermes
 * segments parallel-safe batches), and there is no context compressor — the
 * caller only supplies the compact conversation history it already has.
 */
export async function runAgentTurn(options: AgentTurnOptions): Promise<string> {
  const messages: WireMessage[] = [
    { role: 'system', content: options.systemPrompt },
    ...options.history.map(
      (message): WireMessage =>
        message.role === 'user'
          ? { role: 'user', content: message.content }
          : { role: 'assistant', content: message.content }
    ),
    { role: 'user', content: options.userMessage }
  ]

  let lastContent = ''

  for (let iteration = 0; iteration < options.maxIterations; iteration++) {
    if (options.signal.aborted) {
      return lastContent
    }

    const availableTools = [...AGENT_TOOLS, ...mcpManager.getToolDefinitions()]

    const response = await streamChatCompletion({
      provider: options.provider,
      apiKey: options.apiKey,
      model: options.model,
      messages,
      signal: options.signal,
      tools: availableTools,
      baseUrl: options.baseUrl,
      onDelta: options.onDelta
    })

    lastContent = response.content

    if (options.signal.aborted) {
      return lastContent
    }

    const toolCalls: WireToolCall[] = response.toolCalls.map((call, index) => ({
      ...call,
      id: call.id.length > 0 ? call.id : `call_${iteration}_${index}`
    }))

    messages.push(assistantMessage(response.content, toolCalls))

    if (toolCalls.length === 0) {
      return response.content
    }

    // Hermes suppresses narration produced on tool-call turns so the visible
    // answer does not contain chatty preambles. We streamed it to keep latency
    // low, so tell the renderer to discard it before the next round.
    if (response.content.length > 0) {
      options.onStreamReset()
    }

    for (const call of toolCalls) {
      if (options.signal.aborted) {
        return lastContent
      }

      options.onToolEvent({
        callId: call.id,
        name: call.function.name,
        status: 'running'
      })

      let result: ToolResult

      try {
        result = await executeAgentTool(call.function.name, call.function.arguments, {
          projectId: options.projectId
        })
      } catch (err) {
        result = {
          content: err instanceof Error ? err.message : 'Unknown tool error',
          isError: true
        }
      }

      const toolContent = truncate(result.content, MAX_TOOL_RESULT_CHARS)

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        name: call.function.name,
        content: result.isError ? `[TOOL_ERROR] ${toolContent}` : toolContent
      })

      options.onToolEvent({
        callId: call.id,
        name: call.function.name,
        status: result.isError ? 'error' : 'done',
        detail: summarizeToolResult(result)
      })
    }
  }

  messages.push({
    role: 'user',
    content:
      'You have reached the tool-call limit for this turn. Do not call any more tools. Provide your best final answer now, summarizing what you found.'
  })

  const finalResponse = await streamChatCompletion({
    provider: options.provider,
    apiKey: options.apiKey,
    model: options.model,
    messages,
    signal: options.signal,
    baseUrl: options.baseUrl,
    onDelta: options.onDelta
  })

  return finalResponse.content
}
