import { contextBridge, ipcRenderer } from 'electron'

import type {
  ApiKeyStatus,
  ChatCancelledPayload,
  ChatDeltaPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatStartPayload
} from '../shared/chat'

function subscribe<T>(channel: string, callback: (payload: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: T): void => {
    callback(payload)
  }

  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('deepdesk', {
  settings: {
    status: (): Promise<ApiKeyStatus> => ipcRenderer.invoke('settings:status'),
    saveApiKey: (apiKey: string): Promise<ApiKeyStatus> =>
      ipcRenderer.invoke('settings:save-api-key', apiKey),
    clearApiKey: (): Promise<ApiKeyStatus> => ipcRenderer.invoke('settings:clear-api-key')
  },
  chat: {
    start: (payload: ChatStartPayload): Promise<{ accepted: boolean }> =>
      ipcRenderer.invoke('chat:start', payload),
    cancel: (requestId: string): Promise<{ cancelled: boolean }> =>
      ipcRenderer.invoke('chat:cancel', requestId),
    onDelta: (callback: (payload: ChatDeltaPayload) => void): (() => void) =>
      subscribe('chat:delta', callback),
    onDone: (callback: (payload: ChatDonePayload) => void): (() => void) =>
      subscribe('chat:done', callback),
    onError: (callback: (payload: ChatErrorPayload) => void): (() => void) =>
      subscribe('chat:error', callback),
    onCancelled: (callback: (payload: ChatCancelledPayload) => void): (() => void) =>
      subscribe('chat:cancelled', callback)
  }
})
