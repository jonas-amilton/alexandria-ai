import { useState, useEffect, useCallback } from 'react'

import type {
  ApiKeyStatus,
  ChatDeltaPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatCancelledPayload,
  ChatMessage
} from '../../shared/chat'

// ── Helpers ───────────────────────────────────────────────────────────────

function newRequestId(): string {
  return `req-${crypto.randomUUID()}`
}

// ── App ───────────────────────────────────────────────────────────────────

function App(): React.JSX.Element {
  // Settings state
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')

  // ── Load API key status on mount ──────────────────────────────────────

  useEffect(() => {
    let disposed = false

    const loadApiKeyStatus = async (): Promise<void> => {
      try {
        const status = await window.deepdesk.settings.status()

        if (!disposed) {
          setApiKeyStatus(status)
        }
      } catch {
        if (!disposed) {
          setApiKeyStatus(null)
        }
      }
    }

    void loadApiKeyStatus()

    return () => {
      disposed = true
    }
  }, [])

  // ── Streaming subscriptions ───────────────────────────────────────────

  useEffect(() => {
    const unsubDelta = window.deepdesk.chat.onDelta((payload: ChatDeltaPayload) => {
      setStreamingContent((prev) => prev + payload.content)
    })

    const unsubDone = window.deepdesk.chat.onDone((payload: ChatDonePayload) => {
      if (payload.requestId === currentRequestId) {
        setStreamingContent((current) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: current }])

          return ''
        })

        setIsLoading(false)
        setCurrentRequestId(null)
      }
    })

    const unsubError = window.deepdesk.chat.onError((payload: ChatErrorPayload) => {
      if (payload.requestId === currentRequestId) {
        setError(payload.message)
        setIsLoading(false)
        setCurrentRequestId(null)
        setStreamingContent('')
      }
    })

    const unsubCancelled = window.deepdesk.chat.onCancelled((payload: ChatCancelledPayload) => {
      if (payload.requestId === currentRequestId) {
        // Keep any partial content as a message
        setStreamingContent((current) => {
          if (current.length > 0) {
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `${current} [cancelled]` }
            ])
          }

          return ''
        })

        setIsLoading(false)
        setCurrentRequestId(null)
      }
    })

    return () => {
      unsubDelta()
      unsubDone()
      unsubError()
      unsubCancelled()
    }
  }, [currentRequestId])

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim()

    if (!trimmed) {
      return
    }

    const status = await window.deepdesk.settings.saveApiKey(trimmed)

    setApiKeyStatus(status)
    setApiKeyInput('')

    if (!status.set) {
      setError('Failed to save API key — encryption may not be available')
    } else {
      setError(null)
    }
  }, [apiKeyInput])

  const handleClearApiKey = useCallback(async () => {
    const status = await window.deepdesk.settings.clearApiKey()

    setApiKeyStatus(status)
    setError(null)
  }, [])

  const handleSend = useCallback(async () => {
    const trimmed = messageInput.trim()

    if (!trimmed || isLoading) {
      return
    }

    const requestId = newRequestId()

    setError(null)
    setMessageInput('')
    setCurrentRequestId(requestId)
    setStreamingContent('')
    setIsLoading(true)

    const userMessage: ChatMessage = { role: 'user', content: trimmed }

    setMessages((prev) => [...prev, userMessage])

    // Build history from existing messages (exclude the newest user message which is already in state)
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content
    }))

    const result = await window.deepdesk.chat.start({
      requestId,
      message: trimmed,
      history
    })

    if (!result.accepted) {
      setError('Failed to start chat — request was rejected')
      setIsLoading(false)
      setCurrentRequestId(null)
      setStreamingContent('')
    }
  }, [messageInput, isLoading, messages])

  const handleCancel = useCallback(async () => {
    if (!currentRequestId) {
      return
    }

    await window.deepdesk.chat.cancel(currentRequestId)
  }, [currentRequestId])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-gray-100">
      {/* Header / API Key Status */}
      <header className="border-b border-gray-700 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Alexandria.AI</span>
          <hr />
          <span className="flex-1" />

          {apiKeyStatus === null ? (
            <span className="text-xs text-gray-500">Checando API key…</span>
          ) : apiKeyStatus.set ? (
            <span className="text-xs text-green-400"> API key está configurada</span>
          ) : (
            <span className="text-xs text-yellow-400">
              Nenhuma API key cadastrada
              {apiKeyStatus.canPersist ? '' : ' (encryption unavailable)'}
            </span>
          )}
        </div>
      </header>

      {/* API Key Input (only when not set) */}
      {apiKeyStatus !== null && !apiKeyStatus.set && (
        <div className="border-b border-gray-700 px-4 py-3">
          <div className="flex gap-2">
            <input
              type="password"
              className="flex-1 rounded bg-gray-800 px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="sk-…"
              value={apiKeyInput}
              onChange={(e) => {
                setApiKeyInput(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSaveApiKey()
                }
              }}
            />

            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              disabled={!apiKeyInput.trim()}
              onClick={() => {
                void handleSaveApiKey()
              }}
            >
              Salvar
            </button>

            {apiKeyStatus?.canPersist === false && (
              <span className="self-center text-xs text-red-400">
                Linux: encryption not available (use GNOME Keyring or KDE Wallet)
              </span>
            )}
          </div>
        </div>
      )}

      {/* Clear API Key (only when set) */}
      {apiKeyStatus !== null && apiKeyStatus.set && (
        <div className="border-b border-gray-700 px-4 py-2">
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-200"
            onClick={() => {
              void handleClearApiKey()
            }}
          >
            Resetar API key
          </button>
        </div>
      )}

      {/* Error banner */}
      {error !== null && (
        <div className="border-b border-red-800 bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {error}
          <button
            type="button"
            className="ml-3 text-red-400 hover:text-red-200"
            onClick={() => {
              setError(null)
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streamingContent && (
          <p className="text-center text-sm text-gray-500">
            Olá, eu sou o Alexandria.AI, como posso ajudar você hoje?
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`}
            className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
          >
            <span className="mb-1 block text-xs text-gray-500">
              {msg.role === 'user' ? 'You' : 'Alexandria.AI'}
            </span>

            <div
              className={`inline-block max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {streamingContent && (
          <div className="mb-4 text-left">
            <span className="mb-1 block text-xs text-gray-500">Alexandria.AI</span>

            <div className="inline-block max-w-[80%] rounded-lg bg-gray-800 px-4 py-2 text-sm text-gray-100 whitespace-pre-wrap">
              {streamingContent}
              <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-700 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-1 focus:ring-blue-500"
            placeholder={isLoading ? 'Waiting for response…' : 'Type a message…'}
            value={messageInput}
            onChange={(e) => {
              setMessageInput(e.target.value)
            }}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
          />

          {isLoading ? (
            <button
              type="button"
              className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-600"
              onClick={() => {
                void handleCancel()
              }}
            >
              Cancelar
            </button>
          ) : (
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              disabled={!messageInput.trim()}
              onClick={() => {
                void handleSend()
              }}
            >
              Enviar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
