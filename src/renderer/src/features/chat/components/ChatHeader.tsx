import type { ReactNode } from 'react'

/*
  ChatHeader.tsx — Alexandria.AI

  Breadcrumb funcional (Projeto > Sessão), não decorativo: cada segmento
  é legível e leva a um estado real da aplicação. Ações rápidas à direita
  abrem as modais de engenharia (CodeGraph, Skills, Memória, MCP, Configurações) —
  botões compactos em monospace sem competir com o breadcrumb.
*/

interface ChatHeaderProps {
  projectName?: string
  sessionTitle: string
  onOpenCodeGraph: () => void
  onOpenSkills: () => void
  onOpenMemory: () => void
  onOpenMcp: () => void
  onOpenSettings: () => void
  onToggleMobileMenu?: () => void
}

export function ChatHeader({
  projectName = 'Projeto',
  sessionTitle,
  onOpenCodeGraph,
  onOpenSkills,
  onOpenMemory,
  onOpenMcp,
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
        <HeaderButton label="CodeGraph" onClick={onOpenCodeGraph} />
        <HeaderButton label="Skills" onClick={onOpenSkills} />
        <HeaderButton label="Memória" onClick={onOpenMemory} />
        <HeaderButton label="MCP" onClick={onOpenMcp} />
        <span className="mx-1 h-4 w-px bg-(--color-border)" aria-hidden="true" />
        <HeaderButton label="Configurações" onClick={onOpenSettings} />
      </div>
    </header>
  )
}

function HeaderButton({ label, onClick }: { label: string; onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="rounded-(--radius-sm) px-2 py-1 font-mono text-(length:--text-2xs) text-(--color-text-faint) transition-colors hover:bg-(--color-surface) hover:text-(--color-text)"
    >
      {label}
    </button>
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
