import type { ReactNode } from 'react'

interface ChatHeaderProps {
  title: string
  subtitle?: string
  modelName: string
  providerLabel?: string
  isFreeModel?: boolean
  onOpenSettings?: () => void
  onToggleMobileMenu?: () => void
}

function ChatHeader({
  title,
  subtitle,
  modelName,
  providerLabel,
  isFreeModel,
  onOpenSettings,
  onToggleMobileMenu
}: ChatHeaderProps): ReactNode {
  const dateLabel = subtitle ?? 'Hoje, 10:42'

  return (
    <header className="flex h-[48px] flex-shrink-0 items-center border-b border-[var(--app-border)] bg-[rgba(9,14,24,0.92)] px-3.5 lg:px-6">
      {/* Mobile menu button */}
      <button
        type="button"
        aria-label="Abrir menu"
        className="mr-2.5 flex h-6 w-6 items-center justify-center rounded-[7px] border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] text-[#cbd5e1] md:hidden"
        onClick={onToggleMobileMenu}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Title area */}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[11px] font-medium text-[var(--app-text)] md:text-[13px]">
          {title}
        </h1>
        <p className="text-[8px] text-[var(--app-text-muted)] md:text-[9px]">{dateLabel}</p>
      </div>

      {/* Model Selector Pill */}
      <button
        type="button"
        onClick={onOpenSettings}
        title="Clique para configurar modelo e provedor"
        className="mr-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] px-2.5 py-1 text-[10px] text-[var(--app-text)] hover:border-[var(--app-accent)] transition-colors cursor-pointer"
      >
        <span className="text-[9px]">{providerLabel === 'OpenRouter' ? '🟣' : '🔵'}</span>
        <span className="font-medium truncate max-w-[160px]">{modelName}</span>
        {isFreeModel && (
          <span className="rounded-full bg-emerald-950/80 border border-emerald-800/80 px-1 py-0.2 text-[7px] font-bold text-emerald-400">
            GRÁTIS
          </span>
        )}
        <span className="text-[8px] text-[var(--app-text-muted)]">▾</span>
      </button>

      {/* Settings button */}
      <button
        type="button"
        aria-label="Abrir configurações"
        title="Configurações de modelos e chaves"
        onClick={onOpenSettings}
        className="flex h-7 w-7 items-center justify-center rounded-[7px] border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] text-xs text-[var(--app-text-soft)] hover:text-[var(--app-text)] hover:border-[var(--app-accent)] transition-colors"
      >
        ⚙️
      </button>
    </header>
  )
}

export default ChatHeader
