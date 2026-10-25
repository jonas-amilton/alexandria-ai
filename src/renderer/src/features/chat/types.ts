import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ChatMessage, SessionItem } from '../../../../shared/chat'

export type { ChatMessage, SessionItem } from '../../../../shared/chat'

export interface ToolActivity {
  callId: string
  name: string
  status: 'running' | 'done' | 'error'
  detail?: string
}

export interface UseChatReturn {
  messages: ChatMessage[]
  messageInput: string
  setMessageInput: (value: string) => void
  isLoading: boolean
  error: string | null
  clearError: () => void
  streamingContent: string
  toolActivity: ToolActivity[]
  mode: 'agent' | 'plan'
  setMode: (mode: 'agent' | 'plan') => void
  agentMode: boolean
  toggleAgentMode: () => void
  currentSessionId: string
  conversationTitle: string
  sessions: SessionItem[]
  handleSelectSession: (sessionId: string) => Promise<void>
  handleDeleteSession: (sessionId: string) => Promise<void>
  handleSend: () => Promise<void>
  handleCancel: () => Promise<void>
  handleNewChat: () => void
  handleKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void
}
