interface ChatHeaderProps {
  title: string
  subtitle?: string
  modelName: string
  onToggleMobileMenu?: () => void
}

function ChatHeader({
  title,
  subtitle,
  modelName,
  onToggleMobileMenu
}: ChatHeaderProps): React.JSX.Element {
  const dateLabel = subtitle ?? 'Hoje, 10:42'

  return (
    <header className="flex h-[46px] flex-shrink-0 items-center border-b border-[var(--app-border)] bg-[rgba(9,14,24,0.92)] px-3.5 lg:px-6">
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

      {/* Model badge */}
      <span className="mr-2 inline-flex items-center rounded-full border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] px-2.5 py-1 text-[9px] text-[#cbd5e1]">
        {modelName}
      </span>

      {/* Menu button */}
      <button
        type="button"
        aria-label="Abrir configurações"
        className="flex h-6 w-6 items-center justify-center rounded-[7px] border border-[var(--app-border-soft)] bg-[var(--app-panel-2)] text-[#cbd5e1]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
    </header>
  )
}

export default ChatHeader
