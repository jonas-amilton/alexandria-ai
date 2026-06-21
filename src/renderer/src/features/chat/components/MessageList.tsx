import type { ChatMessage } from '../types'
import MessageItem from './MessageItem'
import ChatEmptyState from './ChatEmptyState'

interface MessageListProps {
  messages: ChatMessage[]
  streamingContent: string
}

function MessageList({ messages, streamingContent }: MessageListProps): React.JSX.Element {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && !streamingContent && <ChatEmptyState />}

      {messages.map((msg, i) => (
        <MessageItem key={`${msg.role}-${i}-${msg.content.slice(0, 20)}`} message={msg} />
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
  )
}

export default MessageList
