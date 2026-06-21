import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ChatMessage } from '../../../../shared/chat'

export type { ChatMessage } from '../../../../shared/chat'

export interface UseChatReturn {
  messages: ChatMessage[]
  messageInput: string
  setMessageInput: (value: string) => void
  isLoading: boolean
  error: string | null
  clearError: () => void
  streamingContent: string
  conversationTitle: string
  handleSend: () => Promise<void>
  handleCancel: () => Promise<void>
  handleNewChat: () => void
  handleKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
}
