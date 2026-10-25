import type { ReactNode } from 'react'

/*
  ChatHeader.tsx — Alexandria.AI

  Breadcrumb funcional (Projeto > Sessão) e acesso centralizado
  às Configurações e Ferramentas técnicas do ecossistema.
*/

interface ChatHeaderProps {
  projectName?: string
  sessionTitle: string
  onOpenSettings: () => void
  onToggleMobileMenu?: () => void
}

export function ChatHeader({
  projectName = 'Projeto',
  sessionTitle,
  onOpenSettings,
  onToggleMobileMenu
}: ChatHeaderProps): ReactNode {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-(--color-border) bg-(--color-panel) px-3">
      <div className="flex min-w-0 items-center gap-2">
        {onToggleMobileMenu && (
          <button
            type="button"
            aria-label="Abrir menu"
            className="flex size-7 items-center justify-center rounded-(--radius-sm) border border-(--color-border) text-(--color-text-muted) md:hidden"
            onClick={onToggleMobileMenu}
          >
            <MenuIcon className="size-3.5" />
          </button>
        )}

        <nav aria-label="Localização atual" className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-(length:--text-sm) text-(--color-text-muted)">
            {projectName}
          </span>
          <span className="text-(--color-text-faint)" aria-hidden="true">
            /
          </span>
          <span className="truncate text-(length:--text-sm) text-(--color-text)">
            {sessionTitle || 'Nova conversa'}
          </span>
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenSettings}
          title="Configurações e Ferramentas (Modelos, MCP, Memória, Skills, CodeGraph)"
          className="flex items-center gap-1.5 rounded-(--radius-sm) border border-(--color-border) px-2.5 py-1 font-mono text-(length:--text-2xs) text-(--color-text-muted) transition-colors hover:border-(--color-border-strong) hover:bg-(--color-surface) hover:text-(--color-text)"
        >
          <span>⚙️</span>
          <span>Configurações</span>
        </button>
      </div>
    </header>
  )
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" strokeLinecap="round" />
    </svg>
  )
}

export default ChatHeader
