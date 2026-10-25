import { contextBridge, ipcRenderer } from 'electron'

import type {
  AgentInspectResult,
  ChatCancelledPayload,
  ChatDeltaPayload,
  ChatDonePayload,
  ChatErrorPayload,
  ChatMessage,
  ChatStartPayload,
  ChatStreamResetPayload,
  ChatToolPayload,
  ProviderTestResult,
  SessionItem,
  SettingsStatus,
  UpdateSettingsPayload
} from '../shared/chat'
import type { CodeGraphData } from '../shared/graph'
import type { McpServerStatus } from '../shared/mcp'
import type { ProjectRecord, ProjectsState } from '../shared/projects'
import type { ProviderId, ProviderModelOption } from '../shared/providers'
import type { RagIndexStats, RagSearchResult } from '../shared/rag'

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
    status: (): Promise<SettingsStatus> => ipcRenderer.invoke('settings:status'),
    update: (payload: UpdateSettingsPayload): Promise<SettingsStatus> =>
      ipcRenderer.invoke('settings:update', payload),
    saveApiKey: (provider: ProviderId, apiKey: string): Promise<SettingsStatus> =>
      ipcRenderer.invoke('settings:save-api-key', { provider, apiKey }),
    clearApiKey: (provider: ProviderId): Promise<SettingsStatus> =>
      ipcRenderer.invoke('settings:clear-api-key', { provider })
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
      subscribe('chat:cancelled', callback),
    onTool: (callback: (payload: ChatToolPayload) => void): (() => void) =>
      subscribe('chat:tool', callback),
    onStreamReset: (callback: (payload: ChatStreamResetPayload) => void): (() => void) =>
      subscribe('chat:stream-reset', callback)
  },
  sessions: {
    list: (projectId?: string): Promise<SessionItem[]> =>
      ipcRenderer.invoke('sessions:list', projectId),
    load: (sessionId: string): Promise<ChatMessage[]> =>
      ipcRenderer.invoke('sessions:load', sessionId),
    delete: (sessionId: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('sessions:delete', sessionId)
  },
  projects: {
    getState: (): Promise<ProjectsState> => ipcRenderer.invoke('projects:get-state'),
    openDialog: (): Promise<ProjectRecord | null> => ipcRenderer.invoke('projects:open-dialog'),
    register: (folderPath: string): Promise<ProjectRecord> =>
      ipcRenderer.invoke('projects:register', folderPath),
    switch: (projectId: string): Promise<ProjectRecord | null> =>
      ipcRenderer.invoke('projects:switch', projectId),
    remove: (projectId: string): Promise<ProjectsState> =>
      ipcRenderer.invoke('projects:remove', projectId),
    getMemory: (projectPath: string): Promise<string> =>
      ipcRenderer.invoke('projects:get-memory', projectPath),
    saveMemory: (projectPath: string, content: string): Promise<{ ok: boolean }> =>
      ipcRenderer.invoke('projects:save-memory', { projectPath, content })
  },
  skills: {
    list: (): Promise<
      Array<{ name: string; description: string; markdown: string; body: string }>
    > => ipcRenderer.invoke('skills:list'),
    get: (
      name: string
    ): Promise<{ name: string; description: string; markdown: string; body: string } | null> =>
      ipcRenderer.invoke('skills:get', name),
    save: (payload: {
      name: string
      description: string
      content: string
    }): Promise<{ ok: boolean; message?: string }> => ipcRenderer.invoke('skills:save', payload),
    delete: (name: string): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('skills:delete', name),
    importFromUrl: (
      url: string
    ): Promise<{
      ok: boolean
      skill?: { name: string; description: string; markdown: string; body: string }
      message?: string
    }> => ipcRenderer.invoke('skills:importFromUrl', url)
  },
  rag: {
    index: (projectId: string, projectPath: string): Promise<RagIndexStats> =>
      ipcRenderer.invoke('rag:index', { projectId, projectPath }),
    stats: (projectId: string): Promise<RagIndexStats> =>
      ipcRenderer.invoke('rag:stats', projectId),
    search: (projectId: string, query: string, limit?: number): Promise<RagSearchResult[]> =>
      ipcRenderer.invoke('rag:search', { projectId, query, limit })
  },
  mcp: {
    getStatuses: (): Promise<McpServerStatus[]> => ipcRenderer.invoke('mcp:get-statuses'),
    reload: (projectPath: string): Promise<McpServerStatus[]> =>
      ipcRenderer.invoke('mcp:reload', projectPath)
  },
  agent: {
    inspect: (): Promise<AgentInspectResult> => ipcRenderer.invoke('agent:inspect')
  },
  agents: {
    getGlobal: (): Promise<string> => ipcRenderer.invoke('agents:getGlobal'),
    saveGlobal: (content: string): Promise<{ ok: boolean; message?: string }> =>
      ipcRenderer.invoke('agents:saveGlobal', content)
  },
  graph: {
    build: (targetDir?: string): Promise<CodeGraphData> =>
      ipcRenderer.invoke('graph:build', targetDir)
  },
  providers: {
    testConnection: (provider: ProviderId, apiKey?: string): Promise<ProviderTestResult> =>
      ipcRenderer.invoke('providers:test-connection', { provider, apiKey }),
    fetchOpenRouterModels: (): Promise<ProviderModelOption[]> =>
      ipcRenderer.invoke('providers:fetch-openrouter-models')
  }
})
