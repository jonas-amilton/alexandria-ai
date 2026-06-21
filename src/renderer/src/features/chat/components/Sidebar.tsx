interface SidebarProps {
  activeTitle: string
  onNewChat: () => void
  onToggleMobile?: () => void
}

const MOCK_CONVERSATIONS = [
  'Planejamento de estudos',
  'Roadmap de produto',
  'Resumo de reuniões',
  'Ideias para SaaS'
]

function Sidebar({ activeTitle, onNewChat, onToggleMobile }: SidebarProps): React.JSX.Element {
  return (
    <aside className="flex h-full w-[200px] flex-shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-panel)] px-3 pt-3">
      {/* Branding */}
      <div className="flex items-center gap-2">
        <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[var(--app-accent)] text-[10px] font-semibold text-white">
          A
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--app-text)]">Alexandria.AI</div>
          <div className="text-[9px] text-[var(--app-text-muted)]">Assistente pessoal</div>
        </div>
      </div>

      {/* New conversation button */}
      <button
        type="button"
        aria-label="Nova conversa"
        className="mt-5 flex h-7.5 w-full items-center justify-start gap-1.5 rounded-[8px] bg-[var(--app-accent)] px-3 text-[10px] font-medium text-white transition-colors hover:bg-[var(--app-accent-hover)]"
        onClick={() => {
          onNewChat()
          onToggleMobile?.()
        }}
      >
        <span className="text-sm leading-none">+</span>
        <span>Nova conversa</span>
      </button>

      {/* Conversations label */}
      <div className="mt-4 border-t border-[var(--app-border)] pt-4 text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
        Conversas
      </div>

      {/* Conversation list */}
      <nav className="mt-2 flex flex-col gap-1">
        {activeTitle !== 'Nova conversa' ? (
          <div className="flex items-center gap-2 rounded-[8px] bg-[var(--app-panel-2)] px-2.5 py-2 text-[10px] text-[var(--app-text)]">
            <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--app-accent)]" />
            <span className="truncate">{activeTitle}</span>
          </div>
        ) : null}

        {MOCK_CONVERSATIONS.map((title) =>
          activeTitle === title ? null : (
            <div
              key={title}
              className="flex items-center gap-2 rounded-[8px] px-2.5 py-2 text-[10px] text-[var(--app-text-soft)] transition-colors hover:bg-[var(--app-panel-2)]"
            >
              <span className="h-[4px] w-[4px] flex-shrink-0 rounded-full bg-[#7586a0]" />
              <span className="truncate">{title}</span>
            </div>
          )
        )}
      </nav>

      {/* Spacer */}
      <div className="mt-auto" />

      {/* User profile */}
      <div className="border-t border-[var(--app-border)] py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[var(--app-panel-3)] text-[10px] font-medium text-[var(--app-text)]">
            J
          </div>
          <div>
            <div className="text-[10px] text-[var(--app-text)]">Jonas Genro</div>
            <div className="text-[9px] text-[var(--app-text-muted)]">Plano pessoal</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
