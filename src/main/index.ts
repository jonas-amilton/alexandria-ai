import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron'
import { join } from 'path'
import { readFile, writeFile, rename, unlink } from 'fs/promises'
import { randomUUID } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import {
  ApiKeyStatusSchema,
  ChatStartPayloadSchema,
  ChatDeltaPayloadSchema,
  ChatDonePayloadSchema,
  ChatErrorPayloadSchema,
  ChatCancelledPayloadSchema
} from '../shared/chat'

// ── Constants ─────────────────────────────────────────────────────────────

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'
const DEEPSEEK_MODEL = 'deepseek-v4-flash'
const DEEPSEEK_TIMEOUT_MS = 120_000
const API_KEY_FILENAME = 'deepdesk-api-key.enc'

// ── Active request cancellation map ───────────────────────────────────────

const activeRequests = new Map<string, AbortController>()

// ── API Key persistence ───────────────────────────────────────────────────

function apiKeyFilePath(): string {
  return join(app.getPath('userData'), API_KEY_FILENAME)
}

function canPersistApiKey(): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    return false
  }

  if (process.platform === 'linux') {
    const backend = safeStorage.getSelectedStorageBackend()

    if (backend === 'basic_text' || backend === 'unknown') {
      return false
    }
  }

  return true
}

async function loadApiKey(): Promise<string | null> {
  try {
    const encrypted = await readFile(apiKeyFilePath())

    return safeStorage.decryptString(encrypted)
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      return null
    }

    throw err
  }
}

async function persistApiKey(apiKey: string): Promise<void> {
  if (!canPersistApiKey()) {
    throw new Error('Encryption not available — cannot persist API key')
  }

  const encrypted = safeStorage.encryptString(apiKey)

  const target = apiKeyFilePath()
  const tmp = `${target}.${randomUUID()}.tmp`

  try {
    await writeFile(tmp, encrypted, { mode: 0o600 })
    await rename(tmp, target)
  } catch (err) {
    // best-effort cleanup
    try {
      await unlink(tmp)
    } catch {
      // ignore cleanup errors
    }

    throw err
  }
}

async function deleteApiKey(): Promise<void> {
  try {
    await unlink(apiKeyFilePath())
  } catch (err: unknown) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      return
    }

    throw err
  }
}

// ── DeepSeek API ──────────────────────────────────────────────────────────

interface DeepSeekDeltaLine {
  choices?: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
}

async function streamDeepSeek(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  signal: AbortSignal,
  onDelta: (content: string) => void
): Promise<void> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    }),
    signal
  })

  if (!response.ok) {
    let detail = ''

    try {
      const body = await response.text()

      detail = body.slice(0, 500)
    } catch {
      // ignore body read errors
    }

    throw new Error(
      `DeepSeek API error ${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`
    )
  }

  if (!response.body) {
    throw new Error('DeepSeek API returned no response body')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (signal.aborted) {
        reader.cancel()

        return
      }

      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')

      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()

        if (!trimmed || !trimmed.startsWith('data:')) {
          continue
        }

        const json = trimmed.slice(5).trim()

        if (json === '[DONE]') {
          return
        }

        try {
          const parsed = JSON.parse(json) as DeepSeekDeltaLine
          const content = parsed.choices?.[0]?.delta?.content

          if (content) {
            onDelta(content)
          }
        } catch {
          // skip unparseable lines
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

function sanitiseLog(text: string): string {
  // Remove anything that looks like an API key (sk-…)
  return text.replace(/sk-[a-zA-Z0-9_-]{16,}/g, 'sk-***')
}

// ── IPC handler helpers ───────────────────────────────────────────────────

function validateSender(
  event: Electron.IpcMainInvokeEvent
): asserts event is Electron.IpcMainInvokeEvent {
  const url = event.senderFrame?.url

  if (!url) {
    return
  }

  // Allow file:// protocol (production) and local dev server
  if (url.startsWith('file://')) {
    return
  }

  if (url.startsWith('http://localhost:') || url.startsWith('https://localhost:')) {
    return
  }

  throw new Error('IPC request from untrusted origin')
}

function logOp(message: string): void {
  console.log(`[deepdesk] ${message}`)
}

// ── Window creation ───────────────────────────────────────────────────────

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)

    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── IPC: ping (test) ──────────────────────────────────────────────────

  ipcMain.on('ping', () => console.log('pong'))

  // ── IPC: settings:status ──────────────────────────────────────────────

  ipcMain.handle('settings:status', async (event) => {
    validateSender(event)

    try {
      const apiKey = await loadApiKey()
      const set = apiKey !== null && apiKey.length > 0
      const persistable = canPersistApiKey()
      let storageBackend: string | undefined

      if (process.platform === 'linux' && persistable) {
        storageBackend = safeStorage.getSelectedStorageBackend()
      }

      return ApiKeyStatusSchema.parse({
        set,
        canPersist: persistable,
        storageBackend
      })
    } catch (err) {
      logOp(`settings:status error: ${sanitiseLog(String(err))}`)

      return { set: false, canPersist: false }
    }
  })

  // ── IPC: settings:save-api-key ────────────────────────────────────────

  ipcMain.handle('settings:save-api-key', async (event, apiKey: unknown) => {
    validateSender(event)

    try {
      const key = String(apiKey ?? '')

      if (!key.startsWith('sk-') || key.length < 20) {
        return ApiKeyStatusSchema.parse({
          set: false,
          canPersist: canPersistApiKey(),
          storageBackend: undefined
        })
      }

      await persistApiKey(key)

      logOp('API key saved')

      return ApiKeyStatusSchema.parse({
        set: true,
        canPersist: true,
        storageBackend:
          process.platform === 'linux' ? safeStorage.getSelectedStorageBackend() : undefined
      })
    } catch (err) {
      logOp(`settings:save-api-key error: ${sanitiseLog(String(err))}`)

      return ApiKeyStatusSchema.parse({
        set: false,
        canPersist: canPersistApiKey(),
        storageBackend: undefined
      })
    }
  })

  // ── IPC: settings:clear-api-key ───────────────────────────────────────

  ipcMain.handle('settings:clear-api-key', async (event) => {
    validateSender(event)

    try {
      await deleteApiKey()

      logOp('API key cleared')

      return ApiKeyStatusSchema.parse({
        set: false,
        canPersist: canPersistApiKey(),
        storageBackend: undefined
      })
    } catch (err) {
      logOp(`settings:clear-api-key error: ${sanitiseLog(String(err))}`)

      return ApiKeyStatusSchema.parse({
        set: false,
        canPersist: canPersistApiKey(),
        storageBackend: undefined
      })
    }
  })

  // ── IPC: chat:start ───────────────────────────────────────────────────

  ipcMain.handle('chat:start', async (event, payload: unknown) => {
    validateSender(event)

    const parseResult = ChatStartPayloadSchema.safeParse(payload)

    if (!parseResult.success) {
      logOp(`chat:start validation error: ${parseResult.error.message}`)

      return { accepted: false }
    }

    const { requestId, message, history } = parseResult.data

    // Load API key
    let apiKey: string | null

    try {
      apiKey = await loadApiKey()
    } catch (err) {
      logOp(`chat:start key load error: ${sanitiseLog(String(err))}`)

      event.sender.send('chat:error', {
        requestId,
        message: 'Failed to load API key'
      } satisfies { requestId: string; message: string })

      return { accepted: true }
    }

    if (!apiKey) {
      event.sender.send('chat:error', {
        requestId,
        message: 'No API key configured'
      } satisfies { requestId: string; message: string })

      return { accepted: true }
    }

    // Build messages array
    const messages = [
      {
        role: 'system' as const,
        content:
          "You are a helpful assistant. Always respond in the same language as the user's message. If the user writes in Portuguese, respond in Portuguese. If the user writes in English, respond in English. Match the user's language exactly."
      },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: message }
    ]

    // Set up abort controller
    const controller = new AbortController()

    activeRequests.set(requestId, controller)

    // Set up timeout
    const timeout = setTimeout(() => {
      controller.abort()
    }, DEEPSEEK_TIMEOUT_MS)

    // Launch streaming in background (don't await — we return accepted immediately)
    ;(async () => {
      try {
        await streamDeepSeek(
          apiKey as string,
          DEEPSEEK_MODEL,
          messages,
          controller.signal,
          (content) => {
            event.sender.send('chat:delta', ChatDeltaPayloadSchema.parse({ requestId, content }))
          }
        )

        if (!controller.signal.aborted) {
          event.sender.send('chat:done', ChatDonePayloadSchema.parse({ requestId }))
        }
      } catch (err) {
        if (controller.signal.aborted) {
          event.sender.send('chat:cancelled', ChatCancelledPayloadSchema.parse({ requestId }))
        } else {
          const message = err instanceof Error ? err.message : 'Unknown error'

          logOp(`chat:stream error: ${sanitiseLog(message)}`)

          event.sender.send(
            'chat:error',
            ChatErrorPayloadSchema.parse({
              requestId,
              message
            })
          )
        }
      } finally {
        clearTimeout(timeout)
        activeRequests.delete(requestId)
      }
    })()

    return { accepted: true }
  })

  // ── IPC: chat:cancel ──────────────────────────────────────────────────

  ipcMain.handle('chat:cancel', async (event, requestId: unknown) => {
    validateSender(event)

    const id = String(requestId ?? '')
    const controller = activeRequests.get(id)

    if (controller) {
      controller.abort()

      logOp(`chat cancelled: ${sanitiseLog(id)}`)

      return { cancelled: true }
    }

    return { cancelled: false }
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
