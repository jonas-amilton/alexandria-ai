import { z } from 'zod'

import { PROVIDER_IDS } from './providers'

// ── Providers & API Key Status ────────────────────────────────────────────

export const ProviderIdSchema = z.enum(PROVIDER_IDS)

export const ApiKeyStatusSchema = z.object({
  set: z.boolean(),
  canPersist: z.boolean(),
  storageBackend: z.string().optional()
})

export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>

export const ProviderKeyStatusesSchema = z.object({
  deepseek: ApiKeyStatusSchema,
  openrouter: ApiKeyStatusSchema
})

export type ProviderKeyStatuses = z.infer<typeof ProviderKeyStatusesSchema>

// ── Settings status ───────────────────────────────────────────────────────

export const SettingsStatusSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().min(1),
  canPersist: z.boolean(),
  keys: ProviderKeyStatusesSchema
})

export type SettingsStatus = z.infer<typeof SettingsStatusSchema>

// Persisted, non-secret settings (userData/settings.json)
export const StoredSettingsSchema = z.object({
  provider: ProviderIdSchema,
  models: z.object({
    deepseek: z.string().min(1),
    openrouter: z.string().min(1)
  })
})

export type StoredSettings = z.infer<typeof StoredSettingsSchema>

// ── Settings payloads ─────────────────────────────────────────────────────

export const SaveApiKeyPayloadSchema = z.object({
  provider: ProviderIdSchema,
  apiKey: z.string()
})

export type SaveApiKeyPayload = z.infer<typeof SaveApiKeyPayloadSchema>

export const ClearApiKeyPayloadSchema = z.object({
  provider: ProviderIdSchema
})

export type ClearApiKeyPayload = z.infer<typeof ClearApiKeyPayloadSchema>

export const UpdateSettingsPayloadSchema = z.object({
  provider: ProviderIdSchema,
  model: z.string().min(1).max(200).optional()
})

export type UpdateSettingsPayload = z.infer<typeof UpdateSettingsPayloadSchema>

// ── Chat Messages ─────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

// ── Chat Start ────────────────────────────────────────────────────────────

export const ChatStartPayloadSchema = z.object({
  requestId: z.string().min(1),
  sessionId: z.string().min(1).max(128).optional(),
  projectId: z.string().optional(),
  message: z.string().min(1),
  history: z.array(ChatMessageSchema).optional().default([]),
  agentMode: z.boolean().optional().default(false)
})

export type ChatStartPayload = z.infer<typeof ChatStartPayloadSchema>

// ── Chat Delta ────────────────────────────────────────────────────────────

export const ChatDeltaPayloadSchema = z.object({
  requestId: z.string(),
  content: z.string()
})

export type ChatDeltaPayload = z.infer<typeof ChatDeltaPayloadSchema>

// ── Chat Done ─────────────────────────────────────────────────────────────

export const ChatDonePayloadSchema = z.object({
  requestId: z.string()
})

export type ChatDonePayload = z.infer<typeof ChatDonePayloadSchema>

// ── Chat Error ────────────────────────────────────────────────────────────

export const ChatErrorPayloadSchema = z.object({
  requestId: z.string(),
  message: z.string()
})

export type ChatErrorPayload = z.infer<typeof ChatErrorPayloadSchema>

// ── Chat Cancelled ────────────────────────────────────────────────────────

export const ChatCancelledPayloadSchema = z.object({
  requestId: z.string()
})

export type ChatCancelledPayload = z.infer<typeof ChatCancelledPayloadSchema>

// ── Tool activity ─────────────────────────────────────────────────────────

export const ChatToolStatusSchema = z.enum(['running', 'done', 'error'])

export const ChatToolPayloadSchema = z.object({
  requestId: z.string(),
  callId: z.string(),
  name: z.string(),
  status: ChatToolStatusSchema,
  detail: z.string().optional()
})

export type ChatToolPayload = z.infer<typeof ChatToolPayloadSchema>

// ── Sessions & Agent Inspection ───────────────────────────────────────────

export const SessionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type SessionItem = z.infer<typeof SessionItemSchema>

export interface AgentInspectResult {
  memory: {
    memory: string[]
    user: string[]
  }
  skills: Array<{
    name: string
    description: string
    markdown: string
  }>
}

export interface ProviderTestResult {
  ok: boolean
  message: string
  credits?: {
    totalCredits: number
    totalUsage: number
    remainingUsd: number
  }
  freeQuota?: {
    used: number
    limit: number
    remaining: number
  }
}

// Emitted when a tool-call round produced narration that should be discarded
// before the final answer starts streaming (Hermes suppresses tool-turn text).
export const ChatStreamResetPayloadSchema = z.object({
  requestId: z.string()
})

export type ChatStreamResetPayload = z.infer<typeof ChatStreamResetPayloadSchema>
