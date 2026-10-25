import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'

import type {
  ChatDeltaPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatCancelledPayload,
  ChatStreamResetPayload,
  ChatToolPayload,
  ChatMessage,
  SessionItem
} from '../../../../../shared/chat'

import type { ToolActivity, UseChatReturn } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function newRequestId(): string {
  return `req-${crypto.randomUUID()}`
}

// ── useChat ─────────────────────────────────────────────────────────────────

function useChat(activeProjectId?: string): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [toolActivity, setToolActivity] = useState<ToolActivity[]>([])
  const [agentMode, setAgentMode] = useState(true)
  const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID())
  const [sessions, setSessions] = useState<SessionItem[]>([])

  const refreshSessions = useCallback(async () => {
    try {
      const list = await window.deepdesk.sessions.list(activeProjectId)
      setSessions(list)
    } catch {
      // ignore
    }
  }, [activeProjectId])

  useEffect(() => {
    let disposed = false

    const loadInitialSessions = async (): Promise<void> => {
      try {
        const list = await window.deepdesk.sessions.list(activeProjectId)
        if (!disposed) {
          setSessions(list)
        }
      } catch {
        // ignore
      }
    }

    void loadInitialSessions()

    return () => {
      disposed = true
    }
  }, [activeProjectId])

  // Refs for guards that must always reflect the latest value without triggering
  // re-renders — prevents duplicate sends from Enter + click occurring in the
  // same event-loop tick.
  const isLoadingRef = useRef(false)
  const currentRequestIdRef = useRef<string | null>(null)
  const draftRef = useRef('')
  const streamingContentRef = useRef('')

  // Keep refs in sync with state
  useEffect(() => {
    isLoadingRef.current = isLoading
  }, [isLoading])

  useEffect(() => {
    currentRequestIdRef.current = currentRequestId
  }, [currentRequestId])

  // ── Streaming subscriptions ────────────────────────────────────────────

  useEffect(() => {
    const unsubDelta = window.deepdesk.chat.onDelta((payload: ChatDeltaPayload) => {
      streamingContentRef.current += payload.content
      setStreamingContent(streamingContentRef.current)
    })

    const unsubDone = window.deepdesk.chat.onDone((payload: ChatDonePayload) => {
      if (payload.requestId === currentRequestIdRef.current) {
        const content = streamingContentRef.current

        streamingContentRef.current = ''
        setStreamingContent('')
        setToolActivity([])
        setMessages((prev) => [...prev, { role: 'assistant', content }])

        setIsLoading(false)
        isLoadingRef.current = false
        setCurrentRequestId(null)
        currentRequestIdRef.current = null
        void refreshSessions()
      }
    })

    const unsubError = window.deepdesk.chat.onError((payload: ChatErrorPayload) => {
      if (payload.requestId === currentRequestIdRef.current) {
        streamingContentRef.current = ''
        setStreamingContent('')
        setToolActivity([])
        setError(payload.message)
        setIsLoading(false)
        isLoadingRef.current = false
        setCurrentRequestId(null)
        currentRequestIdRef.current = null
        void refreshSessions()
        // Restore the draft so the user doesn't lose their message
        setMessageInput(draftRef.current)
      }
    })

    const unsubCancelled = window.deepdesk.chat.onCancelled((payload: ChatCancelledPayload) => {
      if (payload.requestId === currentRequestIdRef.current) {
        // Keep any partial content as a message
        const content = streamingContentRef.current

        streamingContentRef.current = ''
        setStreamingContent('')
        setToolActivity([])

        if (content.length > 0) {
          setMessages((prev) => [...prev, { role: 'assistant', content: `${content} [cancelled]` }])
        }

        setIsLoading(false)
        isLoadingRef.current = false
        setCurrentRequestId(null)
        currentRequestIdRef.current = null
        void refreshSessions()
      }
    })

    const unsubTool = window.deepdesk.chat.onTool((payload: ChatToolPayload) => {
      if (payload.requestId !== currentRequestIdRef.current) {
        return
      }

      setToolActivity((prev) => {
        const next = prev.filter((item) => item.callId !== payload.callId)

        next.push({
          callId: payload.callId,
          name: payload.name,
          status: payload.status,
          detail: payload.detail
        })

        return next
      })
    })

    const unsubStreamReset = window.deepdesk.chat.onStreamReset(
      (payload: ChatStreamResetPayload) => {
        if (payload.requestId !== currentRequestIdRef.current) {
          return
        }

        streamingContentRef.current = ''
        setStreamingContent('')
      }
    )

    return () => {
      unsubDelta()
      unsubDone()
      unsubError()
      unsubCancelled()
      unsubTool()
      unsubStreamReset()
    }
  }, [refreshSessions])

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const trimmed = messageInput.trim()

    if (!trimmed || isLoadingRef.current) {
      return
    }

    const requestId = newRequestId()

    setError(null)
    // Preserve draft before clearing — restored on error
    draftRef.current = trimmed
    setMessageInput('')
    setCurrentRequestId(requestId)
    currentRequestIdRef.current = requestId
    streamingContentRef.current = ''
    setStreamingContent('')
    setToolActivity([])
    setIsLoading(true)
    isLoadingRef.current = true

    const userMessage: ChatMessage = { role: 'user', content: trimmed }

    setMessages((prev) => [...prev, userMessage])

    // Build history from messages that are already committed (excludes the
    // user message we just added — it's already in state but we pass the
    // previous snapshot via the closure).
    const history: ChatMessage[] = messages.map((m) => ({
      role: m.role,
      content: m.content
    }))

    const result = await window.deepdesk.chat.start({
      requestId,
      sessionId,
      projectId: activeProjectId,
      message: trimmed,
      history,
      agentMode
    })

    if (!result.accepted) {
      // Restore draft on rejection
      setMessageInput(trimmed)
      setError('Failed to start chat — request was rejected')
      setIsLoading(false)
      isLoadingRef.current = false
      setCurrentRequestId(null)
      currentRequestIdRef.current = null
      setStreamingContent('')
      setToolActivity([])
    }
  }, [messageInput, messages, agentMode, sessionId, activeProjectId])

  const handleCancel = useCallback(async () => {
    if (!currentRequestIdRef.current) {
      return
    }

    await window.deepdesk.chat.cancel(currentRequestIdRef.current)
  }, [])

  const handleNewChat = useCallback(() => {
    // Cancel any in-flight request first
    if (currentRequestIdRef.current) {
      void window.deepdesk.chat.cancel(currentRequestIdRef.current)
    }

    setMessages([])
    setMessageInput('')
    setError(null)
    streamingContentRef.current = ''
    setStreamingContent('')
    setToolActivity([])
    setIsLoading(false)
    isLoadingRef.current = false
    setCurrentRequestId(null)
    currentRequestIdRef.current = null
    draftRef.current = ''
    setSessionId(crypto.randomUUID())
  }, [])

  const handleSelectSession = useCallback(async (selectedId: string) => {
    if (isLoadingRef.current && currentRequestIdRef.current) {
      void window.deepdesk.chat.cancel(currentRequestIdRef.current)
    }

    try {
      const loadedMessages = await window.deepdesk.sessions.load(selectedId)
      setMessages(loadedMessages)
      setSessionId(selectedId)
      setError(null)
      setStreamingContent('')
      setToolActivity([])
      setIsLoading(false)
      isLoadingRef.current = false
      setCurrentRequestId(null)
      currentRequestIdRef.current = null
    } catch {
      setError('Não foi possível carregar a conversa selecionada.')
    }
  }, [])

  const handleDeleteSession = useCallback(
    async (targetId: string) => {
      try {
        await window.deepdesk.sessions.delete(targetId)
        if (sessionId === targetId) {
          handleNewChat()
        }
        await refreshSessions()
      } catch {
        setError('Falha ao excluir a conversa.')
      }
    },
    [sessionId, handleNewChat, refreshSessions]
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        void handleSend()
      }
    },
    [handleSend]
  )

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const toggleAgentMode = useCallback(() => {
    setAgentMode((prev) => !prev)
  }, [])

  // Derive conversation title from the first user message
  const conversationTitle =
    messages.length > 0
      ? (messages.find((m) => m.role === 'user')?.content.slice(0, 60) ?? 'Nova conversa')
      : 'Nova conversa'

  return {
    messages,
    messageInput,
    setMessageInput,
    isLoading,
    error,
    clearError,
    streamingContent,
    toolActivity,
    agentMode,
    toggleAgentMode,
    currentSessionId: sessionId,
    conversationTitle,
    sessions,
    handleSelectSession,
    handleDeleteSession,
    handleSend,
    handleCancel,
    handleNewChat,
    handleKeyDown
  }
}

export default useChat
