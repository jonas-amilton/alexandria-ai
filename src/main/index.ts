import { app, shell, BrowserWindow, ipcMain, safeStorage, nativeImage } from 'electron'
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
  ChatCancelledPayloadSchema,
  ChatStreamResetPayloadSchema,
  ChatToolPayloadSchema,
  ClearApiKeyPayloadSchema,
  SaveApiKeyPayloadSchema,
  SettingsStatusSchema,
  StoredSettingsSchema,
  UpdateSettingsPayloadSchema,
  type ApiKeyStatus,
  type ProviderTestResult,
  type SettingsStatus,
  type StoredSettings
} from '../shared/chat'
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  isProviderId,
  type ProviderId,
  type ProviderModelOption
} from '../shared/providers'
import { runAgentTurn } from './agent/loop'
import { loadMemorySnapshot } from './agent/memory'
import { buildAgentSystemPrompt } from './agent/prompts'
import {
  closeSessionStore,
  deleteSession,
  getSessionMessages,
  listSessions,
  recordExchange
} from './agent/sessions'
import { deleteSkill, getSkill, listSkills, saveSkill, importSkillFromUrl } from './agent/skills'
import { readGlobalAgentsMd, saveGlobalAgentsMd } from './agent/agents-md'
import { streamChatCompletion, type WireMessage } from './chat-completions'
import { buildCodeGraph } from './graph/codegraph'
import {
  getProjectsState,
  pickProjectDirectory,
  readProjectMemory,
  registerProjectFromPath,
  removeProjectFromList,
  switchActiveProject,
  writeProjectMemory
} from './projects'
import { getRagStats, indexProject, searchRag } from './rag/indexer'
import { mcpManager } from './mcp/manager'

// ── Constants ─────────────────────────────────────────────────────────────

const PROVIDER_TIMEOUT_MS = 120_000
const AGENT_TIMEOUT_MS = 10 * 60_000
const AGENT_MAX_ITERATIONS = 12
const SETTINGS_FILENAME = 'settings.json'
// The first version of the app stored the DeepSeek key under this name.
const LEGACY_API_KEY_FILENAME = 'deepdesk-api-key.enc'

// ── Active request cancellation map ───────────────────────────────────────

const activeRequests = new Map<string, AbortController>()

// ── Settings persistence ──────────────────────────────────────────────────

function settingsFilePath(): string {
  return join(app.getPath('userData'), SETTINGS_FILENAME)
}

function defaultStoredSettings(): StoredSettings {
  return {
    provider: DEFAULT_PROVIDER,
    models: {
      deepseek: PROVIDERS.deepseek.defaultModel,
      openrouter: PROVIDERS.openrouter.defaultModel
    }
  }
}

async function loadStoredSettings(): Promise<StoredSettings> {
  try {
    const raw = await readFile(settingsFilePath(), 'utf8')
    const parsed = StoredSettingsSchema.safeParse(JSON.parse(raw))

    if (parsed.success) {
      return parsed.data
    }

    logOp('settings.json is invalid — using defaults')
  } catch (err) {
    if (!isEnoent(err)) {
      logOp(`settings load error: ${sanitiseLog(String(err))}`)
    }
  }

  return defaultStoredSettings()
}

async function persistStoredSettings(settings: StoredSettings): Promise<void> {
  const target = settingsFilePath()
  const tmp = `${target}.${randomUUID()}.tmp`

  try {
    await writeFile(tmp, JSON.stringify(settings, null, 2), { mode: 0o600 })
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

// ── API Key persistence ───────────────────────────────────────────────────

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  )
}

function apiKeyFilePath(provider: ProviderId): string {
  return join(app.getPath('userData'), `${provider}-api-key.enc`)
}

function legacyApiKeyFilePath(): string {
  return join(app.getPath('userData'), LEGACY_API_KEY_FILENAME)
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

async function readEncryptedApiKey(path: string): Promise<string | null> {
  try {
    const encrypted = await readFile(path)

    return safeStorage.decryptString(encrypted)
  } catch (err) {
    if (isEnoent(err)) {
      return null
    }

    throw err
  }
}

async function loadApiKey(provider: ProviderId): Promise<string | null> {
  const key = await readEncryptedApiKey(apiKeyFilePath(provider))

  if (key !== null) {
    return key
  }

  // Migration fallback: early versions only stored a DeepSeek key, under the
  // legacy filename.
  if (provider === 'deepseek') {
    return readEncryptedApiKey(legacyApiKeyFilePath())
  }

  return null
}

async function persistApiKey(provider: ProviderId, apiKey: string): Promise<void> {
  if (!canPersistApiKey()) {
    throw new Error('Encryption not available — cannot persist API key')
  }

  const encrypted = safeStorage.encryptString(apiKey)

  const target = apiKeyFilePath(provider)
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

async function deleteApiKey(provider: ProviderId): Promise<void> {
  const targets =
    provider === 'deepseek'
      ? [apiKeyFilePath(provider), legacyApiKeyFilePath()]
      : [apiKeyFilePath(provider)]

  for (const target of targets) {
    try {
      await unlink(target)
    } catch (err) {
      if (!isEnoent(err)) {
        throw err
      }
    }
  }
}

async function apiKeyStatus(provider: ProviderId): Promise<ApiKeyStatus> {
  try {
    const apiKey = await loadApiKey(provider)
    const persistable = canPersistApiKey()
    let storageBackend: string | undefined

    if (process.platform === 'linux' && persistable) {
      storageBackend = safeStorage.getSelectedStorageBackend()
    }

    return ApiKeyStatusSchema.parse({
      set: apiKey !== null && apiKey.length > 0,
      canPersist: persistable,
      storageBackend
    })
  } catch (err) {
    logOp(`settings:key status error (${provider}): ${sanitiseLog(String(err))}`)

    return ApiKeyStatusSchema.parse({ set: false, canPersist: false })
  }
}

async function buildSettingsStatus(): Promise<SettingsStatus> {
  const stored = await loadStoredSettings()
  const [deepseek, openrouter] = await Promise.all([
    apiKeyStatus('deepseek'),
    apiKeyStatus('openrouter')
  ])

  return SettingsStatusSchema.parse({
    provider: stored.provider,
    model: stored.models[stored.provider],
    canPersist: canPersistApiKey(),
    keys: { deepseek, openrouter }
  })
}

function sanitiseLog(text: string): string {
  // Remove anything that looks like an API key (sk-…)
  return text.replace(/sk-[a-zA-Z0-9_-]{16,}/g, 'sk-***')
}

// Simplified counterpart to Hermes' context compressor: bound the history by
// message count and characters, keeping the most recent turns.
const MAX_HISTORY_MESSAGES = 30
const MAX_HISTORY_CHARS = 30_000
const MAX_SINGLE_MESSAGE_CHARS = 8_000

function limitHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const recent = history.slice(-MAX_HISTORY_MESSAGES).map((message) => ({
    role: message.role,
    content:
      message.content.length > MAX_SINGLE_MESSAGE_CHARS
        ? message.content.slice(-MAX_SINGLE_MESSAGE_CHARS)
        : message.content
  }))

  const limited: typeof recent = []
  let totalChars = 0

  for (let index = recent.length - 1; index >= 0; index -= 1) {
    const message = recent[index]

    if (limited.length > 0 && totalChars + message.content.length > MAX_HISTORY_CHARS) {
      break
    }

    limited.unshift(message)
    totalChars += message.content.length
  }

  return limited
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
  const appIcon = nativeImage.createFromPath(icon)

  const mainWindow = new BrowserWindow({
    title: 'Alexandria.AI',
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (!appIcon.isEmpty()) {
    mainWindow.setIcon(appIcon)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[renderer console ${level}] ${message} (${sourceId}:${line})`)
  })

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(`[renderer fail load] ${errorCode}: ${errorDescription} (${validatedURL})`)
    }
  )

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

// ── Provider connection test & live models ───────────────────────────────

async function testProviderConnection(
  provider: ProviderId,
  customKey?: string
): Promise<ProviderTestResult> {
  const key = customKey?.trim() || (await loadApiKey(provider))

  if (!key) {
    return { ok: false, message: 'Nenhuma chave configurada para este provedor.' }
  }

  if (provider === 'openrouter') {
    try {
      const authRes = await fetch('https://openrouter.ai/api/v1/auth/key', {
        headers: { Authorization: `Bearer ${key}` }
      })

      if (!authRes.ok) {
        if (authRes.status === 401) {
          return {
            ok: false,
            message: 'Chave de API do OpenRouter inválida ou expirada (HTTP 401).'
          }
        }
        return {
          ok: false,
          message: `Erro ao validar chave com OpenRouter: HTTP ${authRes.status}`
        }
      }

      const authData = (await authRes.json()) as {
        data?: {
          free_model_daily_requests?: { used: number; limit: number; remaining: number }
          effective_budget?: { remaining_usd: number; spend_usd: number }
        }
      }

      let totalCredits = 0
      let totalUsage = 0
      try {
        const creditsRes = await fetch('https://openrouter.ai/api/v1/credits', {
          headers: { Authorization: `Bearer ${key}` }
        })
        if (creditsRes.ok) {
          const creditsJson = (await creditsRes.json()) as {
            data?: { total_credits: number; total_usage: number }
          }
          totalCredits = creditsJson.data?.total_credits ?? 0
          totalUsage = creditsJson.data?.total_usage ?? 0
        }
      } catch {
        // ignore
      }

      const freeQuota = authData.data?.free_model_daily_requests
      const remainingUsd = Math.max(0, totalCredits - totalUsage)

      return {
        ok: true,
        message: 'Conexão com OpenRouter verificada com sucesso!',
        credits: {
          totalCredits,
          totalUsage,
          remainingUsd
        },
        freeQuota: freeQuota
          ? {
              used: freeQuota.used,
              limit: freeQuota.limit,
              remaining: freeQuota.remaining
            }
          : undefined
      }
    } catch (err) {
      return { ok: false, message: `Falha de rede ao conectar com OpenRouter: ${String(err)}` }
    }
  }

  if (provider === 'deepseek') {
    try {
      const res = await fetch('https://api.deepseek.com/user/balance', {
        headers: { Authorization: `Bearer ${key}` }
      })

      if (res.ok) {
        const data = (await res.json()) as { is_available?: boolean }
        return {
          ok: true,
          message: data.is_available
            ? 'Conexão com DeepSeek verificada (conta ativa)!'
            : 'Conexão com DeepSeek verificada.'
        }
      }

      if (res.status === 401) {
        return { ok: false, message: 'Chave DeepSeek inválida ou não autorizada (HTTP 401).' }
      }

      return { ok: true, message: `Conexão efetuada (HTTP ${res.status}).` }
    } catch (err) {
      return { ok: false, message: `Falha ao conectar com DeepSeek: ${String(err)}` }
    }
  }

  return { ok: false, message: 'Provedor desconhecido.' }
}

async function fetchOpenRouterModels(): Promise<ProviderModelOption[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models')
    if (!res.ok) {
      return [...PROVIDERS.openrouter.models]
    }

    const json = (await res.json()) as {
      data?: Array<{
        id: string
        name?: string
        context_length?: number
        description?: string
        pricing?: { prompt?: string; completion?: string }
      }>
    }

    if (!Array.isArray(json.data)) {
      return [...PROVIDERS.openrouter.models]
    }

    const freeModels: ProviderModelOption[] = []
    const paidModels: ProviderModelOption[] = []

    for (const m of json.data) {
      const isFree = m.id.endsWith(':free')
      const item: ProviderModelOption = {
        id: m.id,
        label: isFree ? `${m.name || m.id} (Grátis)` : m.name || m.id,
        isFree,
        contextLength: m.context_length,
        description: m.description ? m.description.slice(0, 160) : undefined
      }

      if (isFree) {
        freeModels.push(item)
      } else {
        paidModels.push(item)
      }
    }

    freeModels.sort((a, b) => a.label.localeCompare(b.label))
    return [...freeModels, ...paidModels.slice(0, 50)]
  } catch {
    return [...PROVIDERS.openrouter.models]
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setName('alexandria-ai')
  electronApp.setAppUserModelId('com.alexandria.ai')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ── IPC: ping (test) ──────────────────────────────────────────────────

  ipcMain.on('ping', () => console.log('pong'))

  // ── IPC: settings:status ──────────────────────────────────────────────

  ipcMain.handle('settings:status', async (event) => {
    validateSender(event)

    try {
      return await buildSettingsStatus()
    } catch (err) {
      logOp(`settings:status error: ${sanitiseLog(String(err))}`)

      return SettingsStatusSchema.parse({
        provider: DEFAULT_PROVIDER,
        model: PROVIDERS[DEFAULT_PROVIDER].defaultModel,
        canPersist: false,
        keys: {
          deepseek: { set: false, canPersist: false },
          openrouter: { set: false, canPersist: false }
        }
      })
    }
  })

  // ── IPC: settings:update ──────────────────────────────────────────────

  ipcMain.handle('settings:update', async (event, payload: unknown) => {
    validateSender(event)

    const parsed = UpdateSettingsPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      logOp(`settings:update validation error: ${parsed.error.message}`)

      return buildSettingsStatus()
    }

    const stored = await loadStoredSettings()
    const models = { ...stored.models }

    if (parsed.data.model !== undefined) {
      models[parsed.data.provider] = parsed.data.model
    }

    const next: StoredSettings = { provider: parsed.data.provider, models }

    try {
      await persistStoredSettings(next)
      logOp(`settings updated: ${next.provider} (${models[next.provider]})`)
    } catch (err) {
      logOp(`settings:update error: ${sanitiseLog(String(err))}`)
    }

    return buildSettingsStatus()
  })

  // ── IPC: settings:save-api-key ────────────────────────────────────────

  ipcMain.handle('settings:save-api-key', async (event, payload: unknown) => {
    validateSender(event)

    const parsed = SaveApiKeyPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      logOp(`settings:save-api-key validation error: ${parsed.error.message}`)

      return buildSettingsStatus()
    }

    const { provider } = parsed.data
    const apiKey = parsed.data.apiKey.trim()
    const definition = PROVIDERS[provider]
    const prefixOk =
      definition.keyPrefixes.length === 0 ||
      definition.keyPrefixes.some((prefix) => apiKey.startsWith(prefix))

    if (!prefixOk || apiKey.length < 20) {
      logOp(`settings:save-api-key rejected invalid key for ${provider}`)

      return buildSettingsStatus()
    }

    try {
      await persistApiKey(provider, apiKey)
      logOp(`API key saved (${provider})`)
    } catch (err) {
      logOp(`settings:save-api-key error (${provider}): ${sanitiseLog(String(err))}`)
    }

    return buildSettingsStatus()
  })

  // ── IPC: settings:clear-api-key ───────────────────────────────────────

  ipcMain.handle('settings:clear-api-key', async (event, payload: unknown) => {
    validateSender(event)

    const parsed = ClearApiKeyPayloadSchema.safeParse(payload)

    if (!parsed.success) {
      logOp(`settings:clear-api-key validation error: ${parsed.error.message}`)

      return buildSettingsStatus()
    }

    try {
      await deleteApiKey(parsed.data.provider)
      logOp(`API key cleared (${parsed.data.provider})`)
    } catch (err) {
      logOp(`settings:clear-api-key error: ${sanitiseLog(String(err))}`)
    }

    return buildSettingsStatus()
  })

  // ── IPC: chat:start ───────────────────────────────────────────────────

  ipcMain.handle('chat:start', async (event, payload: unknown) => {
    validateSender(event)

    const parseResult = ChatStartPayloadSchema.safeParse(payload)

    if (!parseResult.success) {
      logOp(`chat:start validation error: ${parseResult.error.message}`)

      return { accepted: false }
    }

    const {
      requestId,
      sessionId,
      message,
      history,
      mode: requestedMode,
      agentMode,
      projectId: requestedProjectId
    } = parseResult.data
    const mode = requestedMode ?? (agentMode === false ? 'plan' : 'agent')
    const activeSessionId = sessionId ?? 'default-session'

    const projectsState = await getProjectsState()
    const currentProjectId = requestedProjectId || projectsState.activeProjectId || 'default'
    const currentProject =
      projectsState.projects.find((p) => p.id === currentProjectId) ?? projectsState.activeProject

    const stored = await loadStoredSettings()
    const provider = stored.provider
    const model = stored.models[provider]

    // Development-only key fallback for the local mock server.
    const testApiKey = app.isPackaged ? undefined : process.env['ALEXANDRIA_TEST_API_KEY']

    // Load the API key for the active provider
    let apiKey: string | null

    try {
      apiKey = (await loadApiKey(provider)) ?? testApiKey ?? null
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
        message: `No API key configured for ${PROVIDERS[provider].label}`
      } satisfies { requestId: string; message: string })

      return { accepted: true }
    }

    const limitedHistory = limitHistory(history)

    // Development-only endpoint override for the local mock server.
    const testBaseUrl = app.isPackaged ? undefined : process.env['ALEXANDRIA_TEST_BASE_URL']

    // Set up abort controller
    const controller = new AbortController()

    activeRequests.set(requestId, controller)

    const isLoopMode = mode === 'agent' || mode === 'plan' || agentMode === true

    // Set up timeout (agent turns may make several model calls)
    const timeout = setTimeout(
      () => {
        controller.abort()
      },
      isLoopMode ? AGENT_TIMEOUT_MS : PROVIDER_TIMEOUT_MS
    )

    const sendDelta = (content: string): void => {
      event.sender.send('chat:delta', ChatDeltaPayloadSchema.parse({ requestId, content }))
    }

    let finalContent = ''

    // Launch streaming in background (don't await — we return accepted immediately)
    ;(async () => {
      try {
        if (isLoopMode) {
          const [memory, skills, globalAgentsMd] = await Promise.all([
            loadMemorySnapshot(),
            listSkills(),
            readGlobalAgentsMd()
          ])
          let projectMemory = ''
          if (currentProject) {
            try {
              projectMemory = await readProjectMemory(currentProject.path)
            } catch {
              // ignore
            }
          }

          const systemPrompt = buildAgentSystemPrompt({
            providerLabel: PROVIDERS[provider].label,
            model,
            memory,
            skills,
            mode,
            globalAgentsMd,
            projectContext: currentProject
              ? {
                  name: currentProject.name,
                  path: currentProject.path,
                  memory: projectMemory
                }
              : undefined
          })

          finalContent = await runAgentTurn({
            provider,
            apiKey: apiKey as string,
            model,
            systemPrompt,
            history: limitedHistory,
            userMessage: message,
            signal: controller.signal,
            maxIterations: AGENT_MAX_ITERATIONS,
            projectId: currentProjectId,
            baseUrl: testBaseUrl,
            onDelta: sendDelta,
            onToolEvent: (toolEvent) => {
              event.sender.send(
                'chat:tool',
                ChatToolPayloadSchema.parse({ requestId, ...toolEvent })
              )
            },
            onStreamReset: () => {
              event.sender.send(
                'chat:stream-reset',
                ChatStreamResetPayloadSchema.parse({ requestId })
              )
            }
          })
        } else {
          const messages: WireMessage[] = [
            {
              role: 'system',
              content:
                "You are a helpful assistant. Always respond in the same language as the user's message. If the user writes in Portuguese, respond in Portuguese. If the user writes in English, respond in English. Match the user's language exactly."
            },
            ...limitedHistory.map(
              (m): WireMessage =>
                m.role === 'user'
                  ? { role: 'user', content: m.content }
                  : { role: 'assistant', content: m.content }
            ),
            { role: 'user', content: message }
          ]

          const result = await streamChatCompletion({
            provider,
            apiKey: apiKey as string,
            model,
            messages,
            signal: controller.signal,
            baseUrl: testBaseUrl,
            onDelta: sendDelta
          })

          finalContent = result.content
        }

        if (!controller.signal.aborted && finalContent.trim().length > 0) {
          try {
            recordExchange(activeSessionId, message, finalContent, currentProjectId)
          } catch (err) {
            logOp(`session persistence error: ${sanitiseLog(String(err))}`)
          }
        }

        if (controller.signal.aborted) {
          event.sender.send('chat:cancelled', ChatCancelledPayloadSchema.parse({ requestId }))
        } else {
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

  // ── IPC: sessions ─────────────────────────────────────────────────────

  ipcMain.handle('sessions:list', async (event, projectId?: unknown) => {
    validateSender(event)
    const pid = typeof projectId === 'string' && projectId.trim() ? projectId.trim() : undefined
    return listSessions(pid)
  })

  ipcMain.handle('sessions:load', async (event, sessionId: unknown) => {
    validateSender(event)
    const id = String(sessionId ?? '')
    return getSessionMessages(id)
  })

  ipcMain.handle('sessions:delete', async (event, sessionId: unknown) => {
    validateSender(event)
    const id = String(sessionId ?? '')
    deleteSession(id)
    return { ok: true }
  })

  // ── IPC: projects ─────────────────────────────────────────────────────

  ipcMain.handle('projects:get-state', async (event) => {
    validateSender(event)
    return await getProjectsState()
  })

  ipcMain.handle('projects:open-dialog', async (event) => {
    validateSender(event)
    const win = BrowserWindow.fromWebContents(event.sender)
    const picked = await pickProjectDirectory(win ?? undefined)
    if (!picked) return null
    const project = await registerProjectFromPath(picked)
    void mcpManager.loadForProject(project.path)
    void indexProject(project.id, project.path)
    return project
  })

  ipcMain.handle('projects:register', async (event, folderPath: unknown) => {
    validateSender(event)
    const target = String(folderPath ?? '')
    const project = await registerProjectFromPath(target)
    void mcpManager.loadForProject(project.path)
    void indexProject(project.id, project.path)
    return project
  })

  ipcMain.handle('projects:switch', async (event, projectId: unknown) => {
    validateSender(event)
    const id = String(projectId ?? '')
    const project = await switchActiveProject(id)
    if (project) {
      void mcpManager.loadForProject(project.path)
      void indexProject(project.id, project.path)
    }
    return project
  })

  ipcMain.handle('projects:remove', async (event, projectId: unknown) => {
    validateSender(event)
    const id = String(projectId ?? '')
    return await removeProjectFromList(id)
  })

  ipcMain.handle('projects:get-memory', async (event, projectPath: unknown) => {
    validateSender(event)
    return await readProjectMemory(String(projectPath ?? ''))
  })

  ipcMain.handle('projects:save-memory', async (event, payload: unknown) => {
    validateSender(event)
    const data = payload as { projectPath?: unknown; content?: unknown }
    await writeProjectMemory(String(data?.projectPath ?? ''), String(data?.content ?? ''))
    return { ok: true }
  })

  // ── IPC: skills ───────────────────────────────────────────────────────

  ipcMain.handle('skills:list', async (event) => {
    validateSender(event)
    return await listSkills()
  })

  ipcMain.handle('skills:get', async (event, name: unknown) => {
    validateSender(event)
    return await getSkill(String(name ?? ''))
  })

  ipcMain.handle('skills:save', async (event, payload: unknown) => {
    validateSender(event)
    const data = payload as { name?: unknown; description?: unknown; content?: unknown }
    return await saveSkill(
      String(data?.name ?? ''),
      String(data?.description ?? ''),
      String(data?.content ?? '')
    )
  })

  ipcMain.handle('skills:delete', async (event, name: unknown) => {
    validateSender(event)
    return await deleteSkill(String(name ?? ''))
  })

  ipcMain.handle('skills:importFromUrl', async (event, url: unknown) => {
    validateSender(event)
    const urlStr = String(url ?? '').trim()
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      return { ok: false, message: 'URL inválida. Forneça um link HTTP ou HTTPS do GitHub/Gist.' }
    }
    return await importSkillFromUrl(urlStr)
  })

  // ── IPC: rag ──────────────────────────────────────────────────────────

  ipcMain.handle('rag:index', async (event, payload: unknown) => {
    validateSender(event)
    const data = payload as { projectId?: unknown; projectPath?: unknown }
    return await indexProject(String(data?.projectId ?? ''), String(data?.projectPath ?? ''))
  })

  ipcMain.handle('rag:stats', async (event, projectId: unknown) => {
    validateSender(event)
    return getRagStats(String(projectId ?? ''))
  })

  ipcMain.handle('rag:search', async (event, payload: unknown) => {
    validateSender(event)
    const data = payload as { projectId?: unknown; query?: unknown; limit?: unknown }
    return searchRag(
      String(data?.projectId ?? ''),
      String(data?.query ?? ''),
      typeof data?.limit === 'number' ? data.limit : 5
    )
  })

  // ── IPC: mcp ──────────────────────────────────────────────────────────

  ipcMain.handle('mcp:get-statuses', async (event) => {
    validateSender(event)
    return mcpManager.getStatuses()
  })

  ipcMain.handle('mcp:reload', async (event, projectPath: unknown) => {
    validateSender(event)
    await mcpManager.loadForProject(String(projectPath ?? ''))
    return mcpManager.getStatuses()
  })

  // ── IPC: agents (AGENTS.md) ──────────────────────────────────────────

  ipcMain.handle('agents:getGlobal', async (event) => {
    validateSender(event)
    return await readGlobalAgentsMd()
  })

  ipcMain.handle('agents:saveGlobal', async (event, content: unknown) => {
    validateSender(event)
    return await saveGlobalAgentsMd(String(content ?? ''))
  })

  // ── IPC: agent:inspect ────────────────────────────────────────────────

  ipcMain.handle('agent:inspect', async (event) => {
    validateSender(event)
    const [memory, skills] = await Promise.all([loadMemorySnapshot(), listSkills()])
    return { memory, skills }
  })

  // ── IPC: graph:build ──────────────────────────────────────────────────

  ipcMain.handle('graph:build', async (event, targetDir?: unknown) => {
    validateSender(event)
    const dir = typeof targetDir === 'string' && targetDir.trim() ? targetDir.trim() : undefined
    return await buildCodeGraph(dir)
  })

  // ── IPC: providers ────────────────────────────────────────────────────

  ipcMain.handle('providers:test-connection', async (event, payload: unknown) => {
    validateSender(event)
    const data = payload as { provider?: unknown; apiKey?: unknown }
    const provider = isProviderId(data?.provider) ? data.provider : DEFAULT_PROVIDER
    const apiKey = typeof data?.apiKey === 'string' ? data.apiKey : undefined
    return await testProviderConnection(provider, apiKey)
  })

  ipcMain.handle('providers:fetch-openrouter-models', async (event) => {
    validateSender(event)
    return await fetchOpenRouterModels()
  })

  createWindow()

  void (async () => {
    try {
      const pState = await getProjectsState()
      if (pState.activeProject) {
        await mcpManager.loadForProject(pState.activeProject.path)
        void indexProject(pState.activeProject.id, pState.activeProject.path)
      }
    } catch (err) {
      logOp(`startup project init error: ${String(err)}`)
    }
  })()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  mcpManager.stopAll()
  closeSessionStore()
})
