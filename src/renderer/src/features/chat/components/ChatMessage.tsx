import type { ReactNode } from 'react'
import type { ChatMessage as ChatMessageType } from '../types'

interface ChatMessageProps {
  message: ChatMessageType
  isStreaming?: boolean
}

function UserMessage({ message }: { message: ChatMessageType }): ReactNode {
  return (
    <div className="mb-7 flex justify-end gap-2">
      <div style={{ maxWidth: 'min(55%, 650px)' }}>
        <div className="rounded-[12px_12px_4px_12px] bg-[#1b2c4b] px-3.5 py-3 text-[11px] leading-relaxed text-[var(--app-text)] shadow-[0_0_0_1px_rgba(37,55,88,0.35)]">
          {message.content}
        </div>
        <div className="mt-1 text-left text-[8px] text-[#71809a]">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      <div className="mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[7px] bg-[#243654] text-[9px] font-medium text-[var(--app-text)]">
        J
      </div>
    </div>
  )
}

function AssistantMessage({ message }: { message: ChatMessageType }): ReactNode {
  return (
    <div className="mb-6">
      {/* Assistant header */}
      <div className="mb-1.5 flex items-center gap-2">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[7px] bg-[var(--app-accent)] text-[9px] font-semibold text-white">
          A
        </div>
        <span className="text-[11px] font-medium text-[var(--app-text)]">Alexandria.AI</span>
        <span className="inline-flex items-center rounded-full bg-[var(--app-success-bg)] px-1.5 py-0.5 text-[8px] text-[var(--app-success-text)]">
          online
        </span>
      </div>

      {/* Content */}
      <div
        className="whitespace-pre-wrap text-[11px] leading-relaxed text-[#e2e8f0]"
        style={{ maxWidth: 'min(85%, 960px)' }}
      >
        {message.content}
      </div>
    </div>
  )
}

function ChatMessage({ message, isStreaming }: ChatMessageProps): ReactNode {
  if (message.role === 'user') {
    return <UserMessage message={message} />
  }

  return (
    <div>
      <AssistantMessage message={message} />
      {isStreaming && (
        <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-[#7C5CFA]" />
      )}
    </div>
  )
}

export default ChatMessage
