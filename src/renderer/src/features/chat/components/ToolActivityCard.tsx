import { useState, type ReactNode } from 'react'

/*
  ToolActivityCard.tsx — Alexandria.AI

  Representa UMA execução de ferramenta dentro do loop de raciocínio
  (rag_search, codegraph, leitura de MEMORY.md, chamadas mcp__<server>__<tool>).

  Em vez do padrão "IA pensando..." com spinner genérico, o card mostra:
  - nome técnico real da ferramenta e seus parâmetros-chave
  - status discreto (running/success/error) por cor de borda, não por ícone animado
  - tempo decorrido em monospace, atualizado só quando relevante
  - resultado colapsado por padrão (expand sob demanda) — mantém a
    timeline escaneável em tarefas com muitas chamadas de ferramenta
*/

export type ToolStatus = 'pending' | 'running' | 'success' | 'done' | 'error'

export interface ToolActivityItem {
  id?: string
  callId?: string
  toolName?: string
  name?: string
  summary?: string
  status: ToolStatus
  durationMs?: number
  detail?: string
}

const STATUS_BORDER: Record<string, string> = {
  pending: 'border-(--color-border)',
  running: 'border-(--color-accent-blue)',
  success: 'border-(--color-border)',
  done: 'border-(--color-border)',
  error: 'border-(--color-accent-red)'
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-(--color-text-faint)',
  running: 'bg-(--color-accent-blue) animate-pulse',
  success: 'bg-(--color-accent-emerald)',
  done: 'bg-(--color-accent-emerald)',
  error: 'bg-(--color-accent-red)'
}

function formatDuration(ms?: number): string {
  if (ms == null) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function ToolActivityCard({ activity }: { activity: ToolActivityItem }): ReactNode {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = Boolean(activity.detail)
  const name = activity.toolName || activity.name || 'ferramenta'
  const summary =
    activity.summary ||
    (activity.status === 'running'
      ? 'executando...'
      : activity.status === 'error'
        ? 'falha na execução'
        : 'concluído')

  return (
    <div
      className={`rounded-(--radius-sm) border bg-(--color-surface) ${
        STATUS_BORDER[activity.status] || 'border-(--color-border)'
      }`}
    >
      <button
        type="button"
        onClick={() => hasDetail && setExpanded((prev) => !prev)}
        disabled={!hasDetail}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left disabled:cursor-default"
      >
        <span
          className={`size-1.5 shrink-0 rounded-full ${
            STATUS_DOT[activity.status] || 'bg-(--color-text-faint)'
          }`}
          aria-hidden="true"
        />

        <span className="shrink-0 font-mono text-(length:--text-xs) text-(--color-text)">
          {name}
        </span>

        <span className="min-w-0 flex-1 truncate text-(length:--text-xs) text-(--color-text-muted)">
          {summary}
        </span>

        {activity.durationMs != null && (
          <span className="shrink-0 font-mono text-(length:--text-2xs) text-(--color-text-faint)">
            {formatDuration(activity.durationMs)}
          </span>
        )}

        {hasDetail && (
          <ChevronIcon
            className={`size-3 shrink-0 text-(--color-text-faint) transition-transform ${
              expanded ? 'rotate-90' : ''
            }`}
          />
        )}
      </button>

      {expanded && hasDetail && (
        <pre className="overflow-x-auto border-t border-(--color-border) px-2.5 py-2 font-mono text-(length:--text-2xs) text-(--color-text-muted)">
          {activity.detail}
        </pre>
      )}
    </div>
  )
}

function ChevronIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M4.5 2.5l3 3.5-3 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default ToolActivityCard
