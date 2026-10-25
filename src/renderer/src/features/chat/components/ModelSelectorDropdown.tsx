import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from 'react'
import {
  PROVIDERS,
  type ProviderId,
  type ProviderModelOption
} from '../../../../../shared/providers'
import { getCachedOpenRouterModels, prefetchOpenRouterModels } from '../services/models'

interface ModelSelectorDropdownProps {
  open: boolean
  currentProvider: ProviderId
  currentModel: string
  onClose: () => void
  onSelectModel: (provider: ProviderId, modelId: string) => void
  onOpenSettings?: () => void
}

function formatContext(len?: number): string {
  if (!len) return ''
  if (len >= 1_000_000) return `${(len / 1_000_000).toFixed(0)}M ctx`
  if (len >= 1000) return `${Math.round(len / 1000)}k ctx`
  return `${len} ctx`
}

type TabFilter = 'all' | 'free' | 'popular' | 'deepseek'

const POPULAR_SUBSTRINGS = [
  'claude-3.5-sonnet',
  'claude-3.5-haiku',
  'claude-3-opus',
  'gpt-4o',
  'gpt-4o-mini',
  'o1',
  'o3-mini',
  'deepseek-chat',
  'deepseek-reasoner',
  'deepseek-r1',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'llama-3.3-70b',
  'llama-3.1-405b',
  'qwen-2.5-coder',
  'codestral',
  'minimax-01'
]

interface SelectableModel extends ProviderModelOption {
  provider: ProviderId
}

export function ModelSelectorDropdown({
  open,
  currentProvider,
  currentModel,
  onClose,
  onSelectModel,
  onOpenSettings
}: ModelSelectorDropdownProps): ReactNode {
  const [openRouterModels, setOpenRouterModels] = useState<ProviderModelOption[]>(
    () => getCachedOpenRouterModels() ?? [...PROVIDERS.openrouter.models]
  )
  const [isLoading, setIsLoading] = useState<boolean>(() => !getCachedOpenRouterModels())
  const [filter, setFilter] = useState<TabFilter>('all')
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback((): void => {
    setSearch('')
    onClose()
  }, [onClose])

  // Fetch / sync catalog when opened
  useEffect(() => {
    if (!open) return

    let disposed = false
    void prefetchOpenRouterModels().then((models) => {
      if (!disposed) {
        setOpenRouterModels(models)
        setIsLoading(false)
      }
    })

    return () => {
      disposed = true
    }
  }, [open])

  // Focus search input on open
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [open])

  // Click outside & Escape listeners
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        handleClose()
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleClose])

  // Build unified pools
  const allModels: SelectableModel[] = useMemo(() => {
    const dsModels: SelectableModel[] = PROVIDERS.deepseek.models.map((m) => ({
      ...m,
      provider: 'deepseek' as ProviderId
    }))
    const orModels: SelectableModel[] = openRouterModels.map((m) => ({
      ...m,
      provider: 'openrouter' as ProviderId
    }))
    return [...dsModels, ...orModels]
  }, [openRouterModels])

  const freeModels: SelectableModel[] = useMemo(() => {
    return allModels.filter((m) => m.isFree || m.id.endsWith(':free'))
  }, [allModels])

  const popularModels: SelectableModel[] = useMemo(() => {
    return allModels.filter((m) => {
      if (m.provider === 'deepseek') return true
      const idLower = m.id.toLowerCase()
      return POPULAR_SUBSTRINGS.some((pop) => idLower.includes(pop))
    })
  }, [allModels])

  const deepseekModels: SelectableModel[] = useMemo(() => {
    return allModels.filter((m) => m.provider === 'deepseek')
  }, [allModels])

  // Pool according to active tab
  const activePool = useMemo(() => {
    switch (filter) {
      case 'all':
        return allModels
      case 'free':
        return freeModels
      case 'popular':
        return popularModels
      case 'deepseek':
        return deepseekModels
    }
  }, [filter, allModels, freeModels, popularModels, deepseekModels])

  // Real-time search filter
  const displayedModels = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return activePool

    return activePool.filter((m) => {
      return (
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      )
    })
  }, [activePool, search])

  // Check if matches exist across all models if active tab has 0 matches
  const allMatchesCount = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allModels.length
    return allModels.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    ).length
  }, [allModels, search])

  if (!open) return null

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full right-0 z-50 mb-2 w-96 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-(--color-border) pb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-(length:--text-xs) font-medium text-(--color-text)">
            Trocar Modelo
          </span>
          <span className="rounded-full bg-(--color-surface-raised) px-1.5 py-0.2 font-mono text-[9px] text-(--color-text-muted)">
            {allModels.length} disponíveis
          </span>
        </div>
        {isLoading && (
          <span className="flex items-center gap-1 font-mono text-[9px] text-(--color-accent-blue) animate-pulse">
            sincronizando...
          </span>
        )}
      </div>

      {/* Search Input */}
      <div className="relative mt-2">
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, id ou provedor (ex: claude, deepseek, llama)..."
          className="w-full rounded-(--radius-xs) border border-(--color-border) bg-(--color-bg) py-1.5 pl-2.5 pr-7 font-mono text-(length:--text-2xs) text-(--color-text) placeholder:text-(--color-text-faint) focus:border-(--color-accent-blue) focus:outline-none"
        />
        {search.trim() && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-(--color-text-faint) hover:text-(--color-text)"
          >
            ✕
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-2 flex gap-1 rounded-(--radius-xs) bg-(--color-bg) p-0.5 font-mono text-[10px]">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`flex-1 rounded-(--radius-xs) py-1 transition-colors ${
            filter === 'all'
              ? 'bg-(--color-surface-raised) text-(--color-text) font-medium'
              : 'text-(--color-text-faint) hover:text-(--color-text)'
          }`}
        >
          Todos <span className="opacity-70">({allModels.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('free')}
          className={`flex-1 rounded-(--radius-xs) py-1 transition-colors ${
            filter === 'free'
              ? 'bg-(--color-surface-raised) text-(--color-accent-emerald) font-medium'
              : 'text-(--color-text-faint) hover:text-(--color-text)'
          }`}
        >
          Grátis <span className="opacity-70">({freeModels.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('popular')}
          className={`flex-1 rounded-(--radius-xs) py-1 transition-colors ${
            filter === 'popular'
              ? 'bg-(--color-surface-raised) text-(--color-accent-blue) font-medium'
              : 'text-(--color-text-faint) hover:text-(--color-text)'
          }`}
        >
          Populares <span className="opacity-70">({popularModels.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilter('deepseek')}
          className={`flex-1 rounded-(--radius-xs) py-1 transition-colors ${
            filter === 'deepseek'
              ? 'bg-(--color-surface-raised) text-purple-400 font-medium'
              : 'text-(--color-text-faint) hover:text-(--color-text)'
          }`}
        >
          DeepSeek <span className="opacity-70">({deepseekModels.length})</span>
        </button>
      </div>

      {/* Model List */}
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-0.5 scrollbar-thin">
        {displayedModels.map((item) => {
          const isSelected = item.provider === currentProvider && item.id === currentModel
          const isFree = item.isFree || item.id.endsWith(':free')

          return (
            <button
              key={`${item.provider}-${item.id}`}
              type="button"
              onClick={() => {
                onSelectModel(item.provider, item.id)
                handleClose()
              }}
              className={`flex w-full flex-col gap-0.5 rounded-(--radius-xs) px-2.5 py-1.5 text-left transition-colors ${
                isSelected
                  ? 'bg-(--color-surface-raised) border border-(--color-accent-blue)'
                  : 'hover:bg-(--color-surface-raised) border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`truncate text-(length:--text-xs) ${
                      isSelected ? 'font-medium text-(--color-text)' : 'text-(--color-text-muted)'
                    }`}
                  >
                    {item.label}
                  </span>
                  {isFree ? (
                    <span className="shrink-0 rounded bg-emerald-950/80 border border-emerald-800/80 px-1 py-0.2 font-mono text-[8px] font-bold text-emerald-400">
                      GRÁTIS
                    </span>
                  ) : item.provider === 'deepseek' ? (
                    <span className="shrink-0 rounded bg-purple-950/80 border border-purple-800/80 px-1 py-0.2 font-mono text-[8px] font-bold text-purple-300">
                      DEEPSEEK
                    </span>
                  ) : null}
                </div>

                {isSelected && (
                  <span className="shrink-0 font-mono text-(length:--text-xs) text-(--color-accent-blue)">
                    ✓
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 font-mono text-(length:--text-2xs) text-(--color-text-faint)">
                <span className="truncate max-w-56">{item.id}</span>
                {item.contextLength && <span>{formatContext(item.contextLength)}</span>}
              </div>
            </button>
          )
        })}

        {displayedModels.length === 0 && (
          <div className="py-6 text-center font-mono text-(length:--text-2xs) text-(--color-text-faint)">
            <p>Nenhum modelo encontrado nesta aba.</p>
            {filter !== 'all' && allMatchesCount > 0 && (
              <button
                type="button"
                onClick={() => setFilter('all')}
                className="mt-2 inline-flex items-center gap-1 text-(--color-accent-blue) underline hover:text-(--color-text)"
              >
                Ver {allMatchesCount} resultado(s) em &quot;Todos&quot; →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer shortcut to settings */}
      {onOpenSettings && (
        <div className="mt-2 border-t border-(--color-border) pt-1.5">
          <button
            type="button"
            onClick={() => {
              handleClose()
              onOpenSettings()
            }}
            className="flex w-full items-center justify-between px-1 py-0.5 font-mono text-(length:--text-2xs) text-(--color-text-faint) hover:text-(--color-accent-blue)"
          >
            <span>Configurar chaves de API & mais opções</span>
            <span>⚙️ →</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default ModelSelectorDropdown
