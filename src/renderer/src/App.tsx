import { useState, useEffect, useCallback } from 'react'

import type { ApiKeyStatus as ApiKeyStatusType } from '../../shared/chat'

import useChat from './features/chat/hooks/useChat'
import Sidebar from './features/chat/components/Sidebar'
import MobileDrawer from './features/chat/components/MobileDrawer'
import ChatHeader from './features/chat/components/ChatHeader'
import MessageList from './features/chat/components/MessageList'
import ChatComposer from './features/chat/components/ChatComposer'
import ApiKeyInput from './features/settings/components/ApiKeyInput'
import ResetApiKeyButton from './features/settings/components/ResetApiKeyButton'

const MODEL_NAME = 'Alexandria.AI'

// ── App ─────────────────────────────────────────────────────────────────────

function App(): React.JSX.Element {
  // ── Mobile drawer ──────────────────────────────────────────────────────

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  // ── Settings state ─────────────────────────────────────────────────────

  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatusType | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [settingsError, setSettingsError] = useState<string | null>(null)

  // ── Chat ───────────────────────────────────────────────────────────────

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

  // ── Derived ────────────────────────────────────────────────────────────

  const displayError = chat.error ?? settingsError

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar activeTitle={chat.conversationTitle} onNewChat={chat.handleNewChat} />
      </div>

      {/* Mobile drawer */}
      <MobileDrawer open={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)}>
        <Sidebar
          activeTitle={chat.conversationTitle}
          onNewChat={chat.handleNewChat}
          onToggleMobile={() => setMobileDrawerOpen(false)}
        />
      </MobileDrawer>

      {/* Main area */}
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--app-bg)]">
        {/* Header */}
        <ChatHeader
          title={chat.conversationTitle}
          modelName={MODEL_NAME}
          onToggleMobileMenu={() => setMobileDrawerOpen(true)}
        />

        {/* API Key Input (only when not set) */}
        {apiKeyStatus !== null && !apiKeyStatus.set && (
          <ApiKeyInput
            value={apiKeyInput}
            onChange={setApiKeyInput}
            onSave={handleSaveApiKey}
            canPersist={apiKeyStatus.canPersist}
          />
        )}

        {/* Clear API Key (only when set) */}
        {apiKeyStatus !== null && apiKeyStatus.set && (
          <ResetApiKeyButton onClear={handleClearApiKey} />
        )}

        {/* Error banner */}
        {displayError !== null && (
          <div className="flex-shrink-0 border-b border-red-900/60 bg-red-950/30 px-5 py-2 text-[11px] text-red-300 lg:px-6">
            {displayError}
            <button
              type="button"
              className="ml-3 text-red-400 transition-colors hover:text-red-200"
              onClick={() => {
                chat.clearError()
                setSettingsError(null)
              }}
            >
              Dispensar
            </button>
          </div>
        )}

        {/* Messages */}
        <MessageList
          messages={chat.messages}
          streamingContent={chat.streamingContent}
          onFillInput={(text) => {
            chat.setMessageInput(text)
          }}
        />

        {/* Composer */}
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
      </main>
    </div>
  )
}

export default App
