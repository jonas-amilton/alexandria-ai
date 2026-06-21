import { useState, useEffect, useCallback } from 'react'

import type { ApiKeyStatus as ApiKeyStatusType } from '../../shared/chat'

import useChat from './features/chat/hooks/useChat'
import ChatHeader from './features/chat/components/ChatHeader'
import MessageList from './features/chat/components/MessageList'
import ChatComposer from './features/chat/components/ChatComposer'
import ApiKeyStatus from './features/settings/components/ApiKeyStatus'
import ResetApiKeyButton from './features/settings/components/ResetApiKeyButton'

// ── App ─────────────────────────────────────────────────────────────────────

function App(): React.JSX.Element {
  // ── Settings state ─────────────────────────────────────────────────────

  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatusType | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // ── Chat (all state + streaming lives in the hook) ─────────────────────

  const chat = useChat()

  // ── Load API key status on mount ───────────────────────────────────────

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

  // ── Settings handlers ──────────────────────────────────────────────────

  const handleSaveApiKey = useCallback(async () => {
    const trimmed = apiKeyInput.trim()

    if (!trimmed) {
      return
    }

    const status = await window.deepdesk.settings.saveApiKey(trimmed)

    setApiKeyStatus(status)
    setApiKeyInput('')

    if (!status.set) {
      setSettingsError('Failed to save API key — encryption may not be available')
    } else {
      setSettingsError(null)
    }
  }, [apiKeyInput])

  const handleClearApiKey = useCallback(async () => {
    const status = await window.deepdesk.settings.clearApiKey()

    setApiKeyStatus(status)
    setSettingsError(null)
  }, [])

  // ── Combined error display ─────────────────────────────────────────────

  const displayError = chat.error ?? settingsError

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-gray-900 text-gray-100">
      <ChatHeader>
        <ApiKeyStatus status={apiKeyStatus} />
      </ChatHeader>

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
        <ResetApiKeyButton onClear={handleClearApiKey} />
      )}

      {/* Error banner */}
      {displayError !== null && (
        <div className="border-b border-red-800 bg-red-900/50 px-4 py-2 text-sm text-red-300">
          {displayError}
          <button
            type="button"
            className="ml-3 text-red-400 hover:text-red-200"
            onClick={() => {
              chat.clearError()
              setSettingsError(null)
            }}
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList messages={chat.messages} streamingContent={chat.streamingContent} />

      {/* Input */}
      <ChatComposer
        value={chat.messageInput}
        disabled={chat.isLoading}
        isLoading={chat.isLoading}
        onChange={chat.setMessageInput}
        onSubmit={() => {
          void chat.handleSend()
        }}
        onCancel={() => {
          void chat.handleCancel()
        }}
        onKeyDown={chat.handleKeyDown}
      />
    </div>
  )
}

export default App
