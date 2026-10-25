import { useState, useEffect, useMemo, type ReactNode } from 'react'

import type { ProviderTestResult, SettingsStatus } from '../../../../../shared/chat'
import type { McpServerStatus } from '../../../../../shared/mcp'
import {
  PROVIDERS,
  PROVIDER_IDS,
  type ProviderId,
  type ProviderModelOption
} from '../../../../../shared/providers'

interface SettingsModalProps {
  open: boolean
  status: SettingsStatus | null
  activeProjectPath?: string
  onClose: () => void
  onUpdateSettings: (provider: ProviderId, model?: string) => Promise<SettingsStatus>
  onSaveApiKey: (provider: ProviderId, apiKey: string) => Promise<SettingsStatus>
  onClearApiKey: (provider: ProviderId) => Promise<SettingsStatus>
}

type SettingsTab = 'openrouter' | 'deepseek' | 'mcp'
type ModelCategoryFilter = 'free' | 'popular' | 'all'

export default function SettingsModal({
  open,
  status,
  activeProjectPath,
  onClose,
  onUpdateSettings,
  onSaveApiKey,
  onClearApiKey
}: SettingsModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<SettingsTab>('openrouter')
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | null>(null)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState<ModelCategoryFilter>('free')
  const [modelSearch, setModelSearch] = useState('')
  const [customModelInput, setCustomModelInput] = useState('')
  const [openRouterModels, setOpenRouterModels] = useState<readonly ProviderModelOption[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [mcpStatuses, setMcpStatuses] = useState<McpServerStatus[]>([])
  const [loadingMcp, setLoadingMcp] = useState(false)

  const loadMcpStatuses = async (): Promise<void> => {
    try {
      setLoadingMcp(true)
      const list = await window.deepdesk.mcp.getStatuses()
      setMcpStatuses(list)
    } catch {
      // ignore
    } finally {
      setLoadingMcp(false)
    }
  }

  const activeProvider = selectedProvider ?? status?.provider ?? 'openrouter'

  // Fetch live OpenRouter models and MCP statuses on open
  useEffect(() => {
    if (!open) return

    let disposed = false

    window.deepdesk.mcp
      .getStatuses()
      .then((list) => {
        if (!disposed) {
          setMcpStatuses(list)
          setLoadingMcp(false)
        }
      })
      .catch(() => {
        if (!disposed) setLoadingMcp(false)
      })

    window.deepdesk.providers
      .fetchOpenRouterModels()
      .then((models) => {
        if (!disposed) {
          setOpenRouterModels(models)
          setIsLoadingModels(false)
        }
      })
      .catch(() => {
        if (!disposed) {
          setOpenRouterModels(PROVIDERS.openrouter.models)
          setIsLoadingModels(false)
        }
      })

    return () => {
      disposed = true
    }
  }, [open])

  const handleSwitchProvider = (prov: ProviderId): void => {
    setSelectedProvider(prov)
    setApiKeyInput('')
    setTestResult(null)
    setFeedbackMsg(null)
    void onUpdateSettings(prov)
  }

  const currentProviderDef = PROVIDERS[activeProvider]
  const currentKeyStatus = status?.keys[activeProvider]
  const activeModelId = status?.model ?? currentProviderDef.defaultModel

  const availableModels: readonly ProviderModelOption[] = useMemo(() => {
    if (activeProvider === 'openrouter') {
      return openRouterModels.length > 0 ? openRouterModels : PROVIDERS.openrouter.models
    }
    return PROVIDERS.deepseek.models
  }, [activeProvider, openRouterModels])

  const freeModelsCount = useMemo(() => {
    return availableModels.filter((m) => m.isFree).length
  }, [availableModels])

  const filteredModels = useMemo(() => {
    const search = modelSearch.toLowerCase().trim()
    return availableModels.filter((m) => {
      const matchSearch =
        search === '' ||
        m.label.toLowerCase().includes(search) ||
        m.id.toLowerCase().includes(search)

      if (!matchSearch) return false

      if (categoryFilter === 'free') {
        return m.isFree === true
      }
      if (categoryFilter === 'popular') {
        return !m.isFree
      }
      return true
    })
  }, [availableModels, categoryFilter, modelSearch])

  if (!open) return null

  const handleTestConnection = async (): Promise<void> => {
    setIsTesting(true)
    setTestResult(null)
    setFeedbackMsg(null)

    try {
      const res = await window.deepdesk.providers.testConnection(
        activeProvider,
        apiKeyInput.trim() || undefined
      )
      setTestResult(res)
    } catch (err) {
      setTestResult({
        ok: false,
        message: `Falha ao testar conexão: ${String(err)}`
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveKey = async (): Promise<void> => {
    const trimmed = apiKeyInput.trim()
    if (!trimmed) return

    setFeedbackMsg(null)
    const newStatus = await onSaveApiKey(activeProvider, trimmed)
    if (newStatus.keys[activeProvider].set) {
      setFeedbackMsg('Chave salva com sucesso!')
      setApiKeyInput('')
      void handleTestConnection()
    } else {
      setFeedbackMsg('Falha ao salvar chave.')
    }
  }

  const handleClearKey = async (): Promise<void> => {
    await onClearApiKey(activeProvider)
    setTestResult(null)
    setFeedbackMsg('Chave removida.')
  }

  const handleSelectModel = async (modelId: string): Promise<void> => {
    await onUpdateSettings(activeProvider, modelId)
    setFeedbackMsg(`Modelo ativo alterado para ${modelId}`)
  }

  const handleApplyCustomModel = async (): Promise<void> => {
    const trimmed = customModelInput.trim()
    if (!trimmed) return
    await onUpdateSettings(activeProvider, trimmed)
    setCustomModelInput('')
    setFeedbackMsg(`Modelo personalizado ${trimmed} ativado!`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">
                Configurações de Modelos & Provedores
              </h2>
              <p className="text-[10px] text-[var(--app-text-muted)]">
                Gerencie credenciais de API, teste conexão e selecione modelos gratuitos ou premium
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1.5 text-[var(--app-text-muted)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Provider & MCP Tabs */}
        <div className="flex border-b border-[var(--app-border)] bg-[var(--app-panel-2)] px-6 gap-2">
          {PROVIDER_IDS.map((prov) => {
            const isSelected = activeTab === prov
            const isKeySet = status?.keys[prov].set
            return (
              <button
                key={prov}
                type="button"
                onClick={() => {
                  setActiveTab(prov)
                  handleSwitchProvider(prov)
                }}
                className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
                  isSelected
                    ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                    : 'border-transparent text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
                }`}
              >
                <span>{prov === 'openrouter' ? '🟣' : '🔵'}</span>
                <span>{PROVIDERS[prov].label}</span>
                {isKeySet ? (
                  <span className="rounded-full bg-emerald-950/60 border border-emerald-800/80 px-1.5 py-0.2 text-[8px] font-semibold text-emerald-400">
                    Ativo
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-950/40 border border-amber-800/60 px-1.5 py-0.2 text-[8px] text-amber-400">
                    Sem chave
                  </span>
                )}
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setActiveTab('mcp')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'mcp'
                ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                : 'border-transparent text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
            }`}
          >
            <span>🔌</span>
            <span>MCP Servers</span>
            <span className="rounded-full bg-blue-950/60 border border-blue-800/80 px-1.5 py-0.2 text-[8px] font-semibold text-blue-400">
              {mcpStatuses.filter((s) => s.connected).length} ativos
            </span>
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'mcp' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-[var(--app-text)]">
                    Model Context Protocol (MCP)
                  </h3>
                  <p className="text-[10px] text-[var(--app-text-muted)]">
                    Servidores stdio conectados baseados em{' '}
                    <code className="text-[var(--app-text)]">
                      {activeProjectPath || '.'}/.alexandria/mcp.json
                    </code>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    if (activeProjectPath) {
                      setLoadingMcp(true)
                      const list = await window.deepdesk.mcp.reload(activeProjectPath)
                      setMcpStatuses(list)
                      setLoadingMcp(false)
                    } else {
                      await loadMcpStatuses()
                    }
                  }}
                  disabled={loadingMcp}
                  className="rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-1.5 text-[11px] font-medium text-[var(--app-text)] hover:border-[var(--app-accent)] disabled:opacity-50"
                >
                  {loadingMcp ? 'Recarregando...' : '↻ Recarregar MCP'}
                </button>
              </div>

              {mcpStatuses.length === 0 ? (
                <div className="rounded-[10px] border border-dashed border-[var(--app-border)] p-6 text-center space-y-2">
                  <div className="text-[12px] font-medium text-[var(--app-text)]">
                    Nenhum servidor MCP ativo no momento
                  </div>
                  <p className="text-[10px] text-[var(--app-text-muted)] max-w-md mx-auto">
                    Para conectar ferramentas externas ao agente (PostgreSQL, GitHub, Filesystem,
                    etc.), configure o arquivo{' '}
                    <code className="text-[var(--app-accent)]">.alexandria/mcp.json</code> na raiz
                    do projeto.
                  </p>
                  <pre className="mt-3 text-left font-mono text-[10px] bg-[var(--app-panel-2)] p-3 rounded-[6px] text-[var(--app-text-soft)] overflow-x-auto max-w-lg mx-auto border border-[var(--app-border)]">
                    {`{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    }
  }
}`}
                  </pre>
                </div>
              ) : (
                <div className="space-y-3">
                  {mcpStatuses.map((server) => (
                    <div
                      key={server.name}
                      className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-[var(--app-text)]">
                            {server.name}
                          </span>
                          {server.connected ? (
                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                              🟢 Conectado
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[9px] font-medium text-red-400">
                              🔴 Desconectado
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[var(--app-text-muted)] font-mono">
                          {server.command}
                        </span>
                      </div>

                      {server.error && (
                        <div className="text-[10px] text-red-400 bg-red-500/10 p-2 rounded border border-red-500/20">
                          {server.error}
                        </div>
                      )}

                      {server.tools.length > 0 ? (
                        <div className="pt-2 border-t border-[var(--app-border)]">
                          <div className="text-[9px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-1.5">
                            Ferramentas Disponíveis ({server.tools.length})
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {server.tools.map((t) => (
                              <span
                                key={t.name}
                                title={t.description}
                                className="font-mono text-[9px] bg-[var(--app-panel)] border border-[var(--app-border)] px-2 py-0.5 rounded text-[var(--app-accent)]"
                              >
                                {t.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-[var(--app-text-muted)] italic">
                          Nenhuma ferramenta reportada por este servidor.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Section 1: API Key & Connection Diagnostics */}
              <div className="rounded-[10px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--app-text)]">
                      Chave de API ({currentProviderDef.label})
                    </h3>
                    <p className="text-[10px] text-[var(--app-text-muted)]">
                      {currentKeyStatus?.set
                        ? '✓ Chave salva e criptografada com segurança localmente'
                        : 'Nenhuma chave salva. Insira sua chave para habilitar requisições.'}
                    </p>
                  </div>

                  {currentKeyStatus?.set && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleClearKey()
                      }}
                      className="rounded-[6px] border border-red-900/60 bg-red-950/20 px-2.5 py-1 text-[10px] text-red-400 hover:bg-red-950/40 transition-colors"
                    >
                      Remover Chave
                    </button>
                  )}
                </div>

                {/* Input row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[240px]">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder={
                        currentKeyStatus?.set
                          ? '••••••••••••••••••••••••••••••••••••••••'
                          : currentProviderDef.keyPlaceholder
                      }
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="h-8 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 pr-16 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:border-[var(--app-accent)] focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1.5 text-[10px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] px-1"
                    >
                      {showKey ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void handleSaveKey()
                    }}
                    disabled={!apiKeyInput.trim()}
                    className="h-8 rounded-[8px] bg-[var(--app-accent)] px-4 text-xs font-medium text-white transition-colors hover:bg-[var(--app-accent-hover)] disabled:opacity-50"
                  >
                    Salvar Chave
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleTestConnection()
                    }}
                    disabled={isTesting || (!currentKeyStatus?.set && !apiKeyInput.trim())}
                    className="h-8 rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] px-3 text-xs font-medium text-[var(--app-text)] transition-colors hover:border-[var(--app-accent)] disabled:opacity-50"
                  >
                    {isTesting ? 'Testando...' : '🔍 Testar Conexão'}
                  </button>
                </div>

                {/* Feedback message */}
                {feedbackMsg && (
                  <div className="text-[10px] text-emerald-400 font-medium">{feedbackMsg}</div>
                )}

                {/* Test result diagnostics banner */}
                {testResult && (
                  <div
                    className={`rounded-[8px] border p-3 text-xs space-y-1.5 ${
                      testResult.ok
                        ? 'border-emerald-800/80 bg-emerald-950/20 text-emerald-300'
                        : 'border-red-800/80 bg-red-950/20 text-red-300'
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-1.5">
                      <span>{testResult.ok ? '✓' : '⚠️'}</span>
                      <span>{testResult.message}</span>
                    </div>

                    {testResult.freeQuota && (
                      <div className="text-[11px] text-emerald-200">
                        🎉 <strong>Cota Gratuita:</strong> {testResult.freeQuota.remaining} de{' '}
                        {testResult.freeQuota.limit} requisições diárias sem custo disponíveis hoje.
                      </div>
                    )}

                    {testResult.credits && (
                      <div className="text-[11px] text-[var(--app-text-soft)]">
                        Saldo Pago: ${testResult.credits.remainingUsd.toFixed(2)} USD (Consumo
                        total: ${testResult.credits.totalUsage.toFixed(2)})
                      </div>
                    )}

                    {testResult.credits && testResult.credits.remainingUsd <= 0 && (
                      <div className="text-[10px] text-amber-300 bg-amber-950/40 p-2 rounded-[6px] border border-amber-800/60 mt-1">
                        💡 <strong>Créditos pagos esgotados:</strong> Para continuar sem custos,
                        selecione um dos modelos da aba <strong>Modelos Gratuitos</strong> abaixo!
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Section 2: Model Selection & Catalog */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--app-text)]">
                      Catálogo de Modelos (
                      {activeProvider === 'openrouter' ? 'OpenRouter' : 'DeepSeek'})
                    </h3>
                    <p className="text-[10px] text-[var(--app-text-muted)]">
                      Modelo ativo atual:{' '}
                      <span className="font-mono text-[var(--app-accent)] font-semibold">
                        {activeModelId}
                      </span>
                    </p>
                  </div>

                  {/* Filters */}
                  {activeProvider === 'openrouter' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('free')}
                        className={`rounded-[6px] px-2.5 py-1 text-[10px] font-semibold transition-colors flex items-center gap-1 ${
                          categoryFilter === 'free'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-[var(--app-panel-2)] text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        <span>🆓</span>
                        <span>Modelos Gratuitos ({freeModelsCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('popular')}
                        className={`rounded-[6px] px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                          categoryFilter === 'popular'
                            ? 'bg-[var(--app-accent)] text-white shadow-xs'
                            : 'bg-[var(--app-panel-2)] text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        Mais Usados / Pagos
                      </button>
                      <button
                        type="button"
                        onClick={() => setCategoryFilter('all')}
                        className={`rounded-[6px] px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                          categoryFilter === 'all'
                            ? 'bg-[var(--app-accent)] text-white shadow-xs'
                            : 'bg-[var(--app-panel-2)] text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        Todos
                      </button>
                    </div>
                  )}
                </div>

                {/* Search input */}
                <input
                  type="text"
                  placeholder="Buscar modelo por nome ou ID..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="h-8 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:border-[var(--app-accent)] focus:outline-hidden"
                />

                {/* Models list */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {isLoadingModels && availableModels.length === 0 ? (
                    <div className="col-span-2 py-8 text-center text-xs text-[var(--app-text-muted)]">
                      Carregando modelos do provedor...
                    </div>
                  ) : filteredModels.length === 0 ? (
                    <div className="col-span-2 py-8 text-center text-xs text-[var(--app-text-muted)]">
                      Nenhum modelo encontrado com esse filtro.
                    </div>
                  ) : (
                    filteredModels.map((m) => {
                      const isActive = m.id === activeModelId
                      return (
                        <div
                          key={m.id}
                          className={`flex flex-col justify-between rounded-[8px] border p-3 transition-colors ${
                            isActive
                              ? 'border-[var(--app-accent)] bg-[var(--app-panel-2)] shadow-xs'
                              : 'border-[var(--app-border)] bg-[var(--app-panel)] hover:border-[var(--app-border-hover,var(--app-border))]'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-[var(--app-text)] line-clamp-1">
                                {m.label}
                              </span>
                              {m.isFree ? (
                                <span className="rounded-[4px] bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400">
                                  GRÁTIS
                                </span>
                              ) : (
                                <span className="rounded-[4px] bg-[var(--app-panel-2)] border border-[var(--app-border)] px-1.5 py-0.5 text-[8px] font-medium text-[var(--app-text-muted)]">
                                  PAGO
                                </span>
                              )}
                            </div>

                            <div className="mt-1 font-mono text-[9px] text-[var(--app-text-muted)] truncate">
                              {m.id}
                            </div>

                            {m.description && (
                              <p className="mt-1.5 text-[10px] text-[var(--app-text-soft)] line-clamp-2">
                                {m.description}
                              </p>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between pt-2 border-t border-[var(--app-border)]">
                            <span className="text-[9px] text-[var(--app-text-muted)]">
                              {m.contextLength
                                ? `${Math.round(m.contextLength / 1000)}k contexto`
                                : 'Contexto padrão'}
                            </span>

                            <button
                              type="button"
                              onClick={() => {
                                void handleSelectModel(m.id)
                              }}
                              className={`rounded-[6px] px-2.5 py-1 text-[10px] font-medium transition-colors ${
                                isActive
                                  ? 'bg-[var(--app-accent)] text-white'
                                  : 'bg-[var(--app-panel-2)] text-[var(--app-text-soft)] hover:text-[var(--app-text)] hover:bg-[var(--app-accent)] hover:text-white'
                              }`}
                            >
                              {isActive ? '✓ Ativo' : 'Selecionar'}
                            </button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Custom model input for OpenRouter */}
                {activeProvider === 'openrouter' && (
                  <div className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-3 space-y-2">
                    <span className="text-[11px] font-medium text-[var(--app-text)]">
                      Usar outro modelo personalizado do OpenRouter
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="ex: meta-llama/llama-3.3-70b-instruct"
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                        className="h-7 flex-1 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:border-[var(--app-accent)] focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          void handleApplyCustomModel()
                        }}
                        disabled={!customModelInput.trim()}
                        className="h-7 rounded-[6px] bg-[var(--app-accent)] px-3 text-[11px] font-medium text-white transition-colors hover:bg-[var(--app-accent-hover)] disabled:opacity-50"
                      >
                        Ativar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--app-border)] px-6 py-3 flex items-center justify-between bg-[var(--app-panel-2)]">
          <div className="text-[10px] text-[var(--app-text-muted)]">
            As chaves são salvas apenas localmente no dispositivo via Electron SafeStorage.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] bg-[var(--app-accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[var(--app-accent-hover)] transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  )
}
