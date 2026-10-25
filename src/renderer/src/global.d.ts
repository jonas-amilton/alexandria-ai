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
} from '../../shared/chat'
import type { CodeGraphData } from '../../shared/graph'
import type { McpServerStatus } from '../../shared/mcp'
import type { ProjectRecord, ProjectsState } from '../../shared/projects'
import type { ProviderId, ProviderModelOption } from '../../shared/providers'
import type { RagIndexStats, RagSearchResult } from '../../shared/rag'

declare global {
  interface Window {
    deepdesk: {
      settings: {
        status: () => Promise<SettingsStatus>
        update: (payload: UpdateSettingsPayload) => Promise<SettingsStatus>
        saveApiKey: (provider: ProviderId, apiKey: string) => Promise<SettingsStatus>
        clearApiKey: (provider: ProviderId) => Promise<SettingsStatus>
      }
      chat: {
        start: (payload: ChatStartPayload) => Promise<{ accepted: boolean }>
        cancel: (requestId: string) => Promise<{ cancelled: boolean }>
        onDelta: (callback: (payload: ChatDeltaPayload) => void) => () => void
        onDone: (callback: (payload: ChatDonePayload) => void) => () => void
        onError: (callback: (payload: ChatErrorPayload) => void) => () => void
        onCancelled: (callback: (payload: ChatCancelledPayload) => void) => () => void
        onTool: (callback: (payload: ChatToolPayload) => void) => () => void
        onStreamReset: (callback: (payload: ChatStreamResetPayload) => void) => () => void
      }
      sessions: {
        list: (projectId?: string) => Promise<SessionItem[]>
        load: (sessionId: string) => Promise<ChatMessage[]>
        delete: (sessionId: string) => Promise<{ ok: boolean }>
      }
      projects: {
        getState: () => Promise<ProjectsState>
        openDialog: () => Promise<ProjectRecord | null>
        register: (folderPath: string) => Promise<ProjectRecord>
        switch: (projectId: string) => Promise<ProjectRecord | null>
        remove: (projectId: string) => Promise<ProjectsState>
        getMemory: (projectPath: string) => Promise<string>
        saveMemory: (projectPath: string, content: string) => Promise<{ ok: boolean }>
      }
      skills: {
        list: () => Promise<
          Array<{ name: string; description: string; markdown: string; body: string }>
        >
        get: (
          name: string
        ) => Promise<{ name: string; description: string; markdown: string; body: string } | null>
        save: (payload: {
          name: string
          description: string
          content: string
        }) => Promise<{ ok: boolean; message?: string }>
        delete: (name: string) => Promise<{ ok: boolean; message?: string }>
      }
      rag: {
        index: (projectId: string, projectPath: string) => Promise<RagIndexStats>
        stats: (projectId: string) => Promise<RagIndexStats>
        search: (projectId: string, query: string, limit?: number) => Promise<RagSearchResult[]>
      }
      mcp: {
        getStatuses: () => Promise<McpServerStatus[]>
        reload: (projectPath: string) => Promise<McpServerStatus[]>
      }
      agent: {
        inspect: () => Promise<AgentInspectResult>
      }
      graph: {
        build: (targetDir?: string) => Promise<CodeGraphData>
      }
      providers: {
        testConnection: (provider: ProviderId, apiKey?: string) => Promise<ProviderTestResult>
        fetchOpenRouterModels: () => Promise<ProviderModelOption[]>
      }
    }
  }
}
