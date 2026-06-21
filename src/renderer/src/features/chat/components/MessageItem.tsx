import type { ChatMessage } from '../types'

interface MessageItemProps {
  message: ChatMessage
}

function MessageItem({ message }: MessageItemProps): React.JSX.Element {
  const isUser = message.role === 'user'

  return (
    <div className={`mb-4 ${isUser ? 'text-right' : 'text-left'}`}>
      <span className="mb-1 block text-xs text-gray-500">{isUser ? 'You' : 'Alexandria.AI'}</span>

      <div
        className={`inline-block max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
          isUser ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}

export default MessageItem
