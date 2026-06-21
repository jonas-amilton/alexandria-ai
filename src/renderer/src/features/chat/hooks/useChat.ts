import { useState, useEffect, useCallback, useRef } from 'react'

import type {
  ChatDeltaPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatCancelledPayload,
  ChatMessage
} from '../../../../../shared/chat'

import type { UseChatReturn } from '../types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function newRequestId(): string {
  return `req-${crypto.randomUUID()}`
}

// ── useChat ─────────────────────────────────────────────────────────────────

function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  const [streamingContent, setStreamingContent] = useState('')

  // Refs for guards that must always reflect the latest value without triggering
  // re-renders — prevents duplicate sends from Enter + click occurring in the
  // same event-loop tick.
  const isLoadingRef = useRef(false)
  const currentRequestIdRef = useRef<string | null>(null)
  const draftRef = useRef('')

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
      setStreamingContent((prev) => prev + payload.content)
    })

    const unsubDone = window.deepdesk.chat.onDone((payload: ChatDonePayload) => {
      if (payload.requestId === currentRequestIdRef.current) {
        setStreamingContent((current) => {
          setMessages((prev) => [...prev, { role: 'assistant', content: current }])

          return ''
        })

        setIsLoading(false)
        isLoadingRef.current = false
        setCurrentRequestId(null)
        currentRequestIdRef.current = null
      }
    })

    const unsubError = window.deepdesk.chat.onError((payload: ChatErrorPayload) => {
      if (payload.requestId === currentRequestIdRef.current) {
        setError(payload.message)
        setIsLoading(false)
        isLoadingRef.current = false
        setCurrentRequestId(null)
        currentRequestIdRef.current = null
        setStreamingContent('')
        // Restore the draft so the user doesn't lose their message
        setMessageInput(draftRef.current)
      }
    })

    const unsubCancelled = window.deepdesk.chat.onCancelled((payload: ChatCancelledPayload) => {
      if (payload.requestId === currentRequestIdRef.current) {
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
        isLoadingRef.current = false
        setCurrentRequestId(null)
        currentRequestIdRef.current = null
      }
    })

    return () => {
      unsubDelta()
      unsubDone()
      unsubError()
      unsubCancelled()
    }
  }, [currentRequestId])

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
    setStreamingContent('')
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
      message: trimmed,
      history
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
    }
  }, [messageInput, messages])

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
    setStreamingContent('')
    setIsLoading(false)
    isLoadingRef.current = false
    setCurrentRequestId(null)
    currentRequestIdRef.current = null
    draftRef.current = ''
  }, [])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
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
    conversationTitle,
    handleSend,
    handleCancel,
    handleNewChat,
    handleKeyDown
  }
}

export default useChat
