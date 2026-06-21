import { z } from 'zod'

// ── API Key Status ────────────────────────────────────────────────────────

export const ApiKeyStatusSchema = z.object({
  set: z.boolean(),
  canPersist: z.boolean(),
  storageBackend: z.string().optional()
})

export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>

// ── Chat Messages ─────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string()
})

export type ChatMessage = z.infer<typeof ChatMessageSchema>

// ── Chat Start ────────────────────────────────────────────────────────────

export const ChatStartPayloadSchema = z.object({
  requestId: z.string().min(1),
  message: z.string().min(1),
  history: z.array(ChatMessageSchema).optional().default([])
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
