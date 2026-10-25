import { useState, useRef, useEffect, type ReactNode } from 'react'
import { PROVIDERS, type ProviderId } from '../../../../../shared/providers'

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

export function ModelSelectorDropdown({
  open,
  currentProvider,
  currentModel,
  onClose,
  onSelectModel,
  onOpenSettings
}: ModelSelectorDropdownProps): ReactNode {
  const [filter, setFilter] = useState<'free' | 'popular' | 'deepseek'>('free')
  const [search, setSearch] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
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
  }, [open, onClose])

  if (!open) return null

  // Models list depending on tab filter
  let displayedModels =
    filter === 'deepseek'
      ? PROVIDERS.deepseek.models.map((m) => ({ ...m, provider: 'deepseek' as ProviderId }))
      : filter === 'free'
        ? PROVIDERS.openrouter.models
            .filter((m) => m.isFree)
            .map((m) => ({ ...m, provider: 'openrouter' as ProviderId }))
        : PROVIDERS.openrouter.models
            .filter((m) => !m.isFree)
            .map((m) => ({ ...m, provider: 'openrouter' as ProviderId }))

  if (search.trim()) {
    const q = search.toLowerCase()
    displayedModels = displayedModels.filter(
      (m) =>
        m.label.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
    )
  }

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full right-0 z-50 mb-2 w-80 rounded-(--radius-md) border border-(--color-border-strong) bg-(--color-surface) p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center justify-between border-b border-(--color-border) pb-2">
        <span className="font-mono text-(length:--text-xs) font-medium text-(--color-text)">
          Trocar Modelo
        </span>
        <span className="font-mono text-(length:--text-2xs) text-(--color-text-faint)">
          1-clique
        </span>
      </div>

      {/* Tabs */}
      <div className="mt-2 flex gap-1 rounded-(--radius-xs) bg-(--color-bg) p-0.5 font-mono text-(length:--text-2xs)">
        <button
          type="button"
          onClick={() => setFilter('free')}
          className={`flex-1 rounded-(--radius-xs) py-1 transition-colors ${
            filter === 'free'
              ? 'bg-(--color-surface-raised) text-(--color-accent-emerald) font-medium'
              : 'text-(--color-text-faint) hover:text-(--color-text)'
          }`}
        >
          Grátis
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
          Populares
        </button>
        <button
          type="button"
          onClick={() => setFilter('deepseek')}
          className={`flex-1 rounded-(--radius-xs) py-1 transition-colors ${
            filter === 'deepseek'
              ? 'bg-(--color-surface-raised) text-(--color-text) font-medium'
              : 'text-(--color-text-faint) hover:text-(--color-text)'
          }`}
        >
          DeepSeek
        </button>
      </div>

      {/* Search */}
      <div className="mt-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar modelos..."
          className="w-full rounded-(--radius-xs) border border-(--color-border) bg-(--color-bg) px-2 py-1 font-mono text-(length:--text-2xs) text-(--color-text) placeholder:text-(--color-text-faint) focus:border-(--color-accent-blue) focus:outline-none"
        />
      </div>

      {/* Model List */}
      <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-0.5">
        {displayedModels.map((item) => {
          const isSelected = item.provider === currentProvider && item.id === currentModel
          return (
            <button
              key={`${item.provider}-${item.id}`}
              type="button"
              onClick={() => {
                onSelectModel(item.provider, item.id)
                onClose()
              }}
              className={`flex w-full flex-col gap-0.5 rounded-(--radius-xs) px-2 py-1.5 text-left transition-colors ${
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
                  {item.isFree && (
                    <span className="shrink-0 rounded bg-emerald-950/80 border border-emerald-800/80 px-1 py-0.2 font-mono text-[9px] font-bold text-emerald-400">
                      GRÁTIS
                    </span>
                  )}
                </div>

                {isSelected && (
                  <span className="shrink-0 font-mono text-(length:--text-xs) text-(--color-accent-blue)">
                    ✓
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 font-mono text-(length:--text-2xs) text-(--color-text-faint)">
                <span className="truncate max-w-44">{item.id}</span>
                {item.contextLength && <span>{formatContext(item.contextLength)}</span>}
              </div>
            </button>
          )
        })}

        {displayedModels.length === 0 && (
          <div className="py-4 text-center font-mono text-(length:--text-2xs) text-(--color-text-faint)">
            Nenhum modelo encontrado
          </div>
        )}
      </div>

      {/* Footer shortcut to settings */}
      {onOpenSettings && (
        <div className="mt-2 border-t border-(--color-border) pt-1.5">
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenSettings()
            }}
            className="flex w-full items-center justify-between px-1 py-0.5 font-mono text-(length:--text-2xs) text-(--color-text-faint) hover:text-(--color-accent-blue)"
          >
            <span>Configurar chaves & mais modelos</span>
            <span>⚙️ →</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default ModelSelectorDropdown
