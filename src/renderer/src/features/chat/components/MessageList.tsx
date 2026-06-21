import type { ReactNode } from 'react'
import type { ChatMessage } from '../types'
import ChatMessageView from './ChatMessage'
import EmptyState from './EmptyState'
import StreamingIndicator from './StreamingIndicator'

interface MessageListProps {
  messages: ChatMessage[]
  streamingContent: string
  onFillInput: (text: string) => void
}

function MessageList({ messages, streamingContent, onFillInput }: MessageListProps): ReactNode {
  const hasContent = messages.length > 0 || streamingContent.length > 0

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-6 sm:px-6 md:px-8 lg:px-10">
      <div className="mx-auto w-full">
        {hasContent && (
          <div className="mb-4 flex justify-center">
            <span className="inline-flex items-center rounded-full border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2.5 py-1 text-[7px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-soft)]">
              Hoje
            </span>
          </div>
        )}

        {!hasContent && <EmptyState onFillInput={onFillInput} />}

        {messages.map((msg, i) => (
          <ChatMessageView key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`} message={msg} />
        ))}

        {streamingContent && (
          <div className="mb-5">
            <div className="mb-1.5 flex items-center gap-2">
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[7px] bg-[var(--app-accent)] text-[9px] font-semibold text-white">
                A
              </div>
              <span className="text-[11px] font-medium text-[var(--app-text)]">Alexandria.AI</span>
              <span className="inline-flex items-center rounded-full bg-[var(--app-success-bg)] px-1.5 py-0.5 text-[8px] text-[var(--app-success-text)]">
                online
              </span>
            </div>
            <div
              className="text-[11px] leading-relaxed text-[#e2e8f0]"
              style={{ maxWidth: 'min(85%, 960px)' }}
            >
              <StreamingIndicator content={streamingContent} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageList
