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
  handleSend: () => Promise<void>
  handleCancel: () => Promise<void>
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
}
