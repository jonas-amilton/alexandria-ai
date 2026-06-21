import type {
  ApiKeyStatus,
  ChatCancelledPayload,
  ChatDeltaPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatStartPayload
} from '../../shared/chat'

declare global {
  interface Window {
    deepdesk: {
      settings: {
        status: () => Promise<ApiKeyStatus>
        saveApiKey: (apiKey: string) => Promise<ApiKeyStatus>
        clearApiKey: () => Promise<ApiKeyStatus>
      }
      chat: {
        start: (payload: ChatStartPayload) => Promise<{ accepted: boolean }>
        cancel: (requestId: string) => Promise<{ cancelled: boolean }>
        onDelta: (callback: (payload: ChatDeltaPayload) => void) => () => void
        onDone: (callback: (payload: ChatDonePayload) => void) => () => void
        onError: (callback: (payload: ChatErrorPayload) => void) => () => void
        onCancelled: (callback: (payload: ChatCancelledPayload) => void) => () => void
      }
    }
  }
}
