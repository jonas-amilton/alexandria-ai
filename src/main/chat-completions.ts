import { PROVIDERS, type ProviderId } from '../shared/providers'

// ── Wire types (OpenAI-compatible chat completions) ──────────────────────

export interface WireToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface WireSystemMessage {
  role: 'system'
  content: string
}

export interface WireUserMessage {
  role: 'user'
  content: string
}

export interface WireAssistantMessage {
  role: 'assistant'
  content: string | null
  tool_calls?: WireToolCall[]
}

export interface WireToolMessage {
  role: 'tool'
  tool_call_id: string
  name?: string
  content: string
}

export type WireMessage =
  | WireSystemMessage
  | WireUserMessage
  | WireAssistantMessage
  | WireToolMessage

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ChatCompletionResult {
  content: string
  toolCalls: WireToolCall[]
  finishReason: string | null
}

// ── Streaming —> assembled result ─────────────────────────────────────────

interface ChatCompletionDeltaLine {
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: Array<{
        index?: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
}

export interface StreamChatCompletionOptions {
  provider: ProviderId
  apiKey: string
  model: string
  messages: WireMessage[]
  signal: AbortSignal
  tools?: ToolDefinition[]
  /** Development-only override used by the local mock server in tests. */
  baseUrl?: string
  onDelta?: (content: string) => void
}

export async function streamChatCompletion(
  options: StreamChatCompletionOptions
): Promise<ChatCompletionResult> {
  const { provider, apiKey, model, messages, signal, tools, baseUrl, onDelta } = options
  const definition = PROVIDERS[provider]

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true
  }

  if (tools && tools.length > 0) {
    body.tools = tools
    body.tool_choice = 'auto'

    // Hermes' DeepSeek profile always sets `thinking` explicitly for v4+ /
    // deepseek-flash models; otherwise the API defaults to thinking ON and
    // rejects the follow-up tool-result request with a 400 unless
    // reasoning_content is echoed back. Disabling it keeps agent turns valid.
    const normalizedModel = model.trim().toLowerCase()
    const deepSeekThinkingCapable =
      (normalizedModel.startsWith('deepseek-v') && !normalizedModel.startsWith('deepseek-v3')) ||
      normalizedModel === 'deepseek-flash'

    if (provider === 'deepseek' && deepSeekThinkingCapable) {
      body.thinking = { type: 'disabled' }
    }
  }

  const response = await fetch(`${baseUrl ?? definition.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...definition.extraHeaders
    },
    body: JSON.stringify(body),
    signal
  })

  if (!response.ok) {
    let detail = ''

    try {
      const errorBody = await response.text()
      try {
        const json = JSON.parse(errorBody)
        if (json?.error?.message) {
          detail = String(json.error.message)
        } else {
          detail = errorBody.slice(0, 300)
        }
      } catch {
        detail = errorBody.slice(0, 300)
      }
    } catch {
      // ignore body read errors
    }

    if (response.status === 402) {
      throw new Error(
        `Créditos insuficientes no OpenRouter (HTTP 402). Adicione saldo em openrouter.ai/settings/credits ou selecione um modelo gratuito (:free) como "nvidia/nemotron-3.5-lightning:free".`
      )
    }

    if (response.status === 401) {
      throw new Error(
        `Chave de API inválida ou não autorizada no ${definition.label} (HTTP 401). Verifique ou reconfigure a chave nas Configurações (⚙️).`
      )
    }

    if (response.status === 404) {
      throw new Error(
        `Modelo "${model}" não encontrado ou descontinuado no ${definition.label} (HTTP 404). Selecione outro modelo nas Configurações.`
      )
    }

    throw new Error(
      `${definition.label} API error ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`
    )
  }

  if (!response.body) {
    throw new Error(`${definition.label} API returned no response body`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const toolCalls = new Map<number, WireToolCall>()

  let buffer = ''
  let content = ''
  let finishReason: string | null = null

  const handleLine = (line: string): boolean => {
    const trimmed = line.trim()

    if (!trimmed || !trimmed.startsWith('data:')) {
      return false
    }

    const json = trimmed.slice(5).trim()

    if (json === '[DONE]') {
      return true
    }

    try {
      const parsed = JSON.parse(json) as ChatCompletionDeltaLine
      const choice = parsed.choices?.[0]
      const delta = choice?.delta

      if (delta?.content) {
        content += delta.content
        onDelta?.(delta.content)
      }

      for (const fragment of delta?.tool_calls ?? []) {
        const index = fragment.index ?? 0
        const existing = toolCalls.get(index) ?? {
          id: '',
          type: 'function' as const,
          function: { name: '', arguments: '' }
        }

        if (fragment.id) {
          existing.id = fragment.id
        }

        // Some providers resend the name on later fragments; assign instead of
        // concatenating (same behavior as Hermes' tool-call accumulator).
        if (fragment.function?.name) {
          existing.function.name = fragment.function.name
        }

        if (fragment.function?.arguments) {
          existing.function.arguments += fragment.function.arguments
        }

        toolCalls.set(index, existing)
      }

      if (choice?.finish_reason) {
        finishReason = choice.finish_reason
      }
    } catch {
      // skip unparseable lines
    }

    return false
  }

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (signal.aborted) {
        reader.cancel()

        break
      }

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      let reachedDone = false

      for (const line of lines) {
        if (handleLine(line)) {
          reachedDone = true

          break
        }
      }

      if (reachedDone) {
        break
      }
    }

    if (buffer.length > 0) {
      handleLine(buffer)
    }
  } finally {
    reader.releaseLock()
  }

  return {
    content,
    toolCalls: [...toolCalls.values()].filter((call) => call.function.name.length > 0),
    finishReason
  }
}
