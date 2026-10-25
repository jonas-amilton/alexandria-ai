import { useMemo, useState, useRef, useEffect, type ReactNode } from 'react'

import type { SessionItem } from '../../../../../shared/chat'
import type { ProjectRecord } from '../../../../../shared/projects'
import type { RagIndexStats } from '../../../../../shared/rag'
import AnimatedOwl from './AnimatedOwl'

/*
  Sidebar.tsx — Alexandria.AI

  Layout de alta densidade estilo painel de IDE (Linear / Zed):
  - Cabeçalho de projeto com caminho truncado e status do RAG local.
  - Dropdown discreto para alternar entre projetos recentes ou abrir nova pasta.
  - Barra de busca de conversas (FTS5) e botão de nova conversa.
  - Lista de sessões com timestamps relativos em monospace e botão de remoção no hover.
*/

interface SidebarProps {
  currentSessionId: string
  activeTitle?: string
  sessions: SessionItem[]
  activeProject: ProjectRecord | null
  projects: ProjectRecord[]
  ragStats?: RagIndexStats | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onNewChat: () => void
  onToggleMobile?: () => void
  onOpenProjectDialog: () => void
  onSwitchProject: (id: string) => void
  onRemoveProject: (id: string) => void
  onOpenMemoryModal?: () => void
  onOpenSkillsModal?: () => void
  onOpenGraphModal?: () => void
  onOpenSettingsModal?: () => void
}

function truncatePath(path: string, maxSegments = 2): string {
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length <= maxSegments) return path
  return `…/${parts.slice(-maxSegments).join('/')}`
}

function formatRelativeTime(epochMsOrIso?: number | string): string {
  if (!epochMsOrIso) return ''
  const epochMs =
    typeof epochMsOrIso === 'number'
      ? epochMsOrIso
      : isNaN(Date.parse(epochMsOrIso))
        ? 0
        : Date.parse(epochMsOrIso)
  if (epochMs === 0) return ''

  const diffSec = Math.max(0, Math.floor((Date.now() - epochMs) / 1000))
  if (diffSec < 60) return 'agora'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  return `${Math.floor(diffSec / 86400)}d`
}

export function Sidebar({
  currentSessionId,
  activeTitle,
  sessions,
  activeProject,
  projects,
  ragStats,
  onSelectSession,
  onDeleteSession,
  onNewChat,
  onToggleMobile,
  onOpenProjectDialog,
  onSwitchProject,
  onRemoveProject
}: SidebarProps): ReactNode {
  const [query, setQuery] = useState('')
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fecha o dropdown de projetos ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filtragem local com busca FTS5 / texto
  const filteredSessions = useMemo(() => {
    const list = [...sessions]
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter((s) => s.title.toLowerCase().includes(q))
  }, [sessions, query])

  const ragIndexed = ragStats && ragStats.indexedFiles > 0

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r border-(--color-border) bg-(--color-panel) text-(--color-text)"
      aria-label="Navegação de projeto e sessões"
    >
      {/* Branding com Coruja Tech */}
      <div className="flex items-center gap-2.5 border-b border-(--color-border) px-3 py-2.5">
        <AnimatedOwl size="sm" mood="idle" />
        <div className="flex flex-col">
          <span className="font-mono text-(length:--text-xs) font-medium text-(--color-text)">
            Alexandria.AI
          </span>
          <span className="font-mono text-(length:--text-2xs) text-(--color-text-faint)">
            Agente Autônomo
          </span>
        </div>
      </div>

      {/* Cabeçalho de projeto com seletor dropdown */}
      <div
        className="relative flex flex-col gap-1.5 border-b border-(--color-border) px-3 py-3"
        ref={dropdownRef}
      >
        <button
          type="button"
          onClick={() => setProjectDropdownOpen((prev) => !prev)}
          className="group flex w-full items-center justify-between rounded-(--radius-sm) px-1.5 py-1 text-left transition-colors hover:bg-(--color-surface)"
          title={activeProject?.path ?? 'Nenhum projeto aberto'}
        >
          <span className="truncate font-mono text-(length:--text-xs) text-(--color-text-muted) group-hover:text-(--color-text)">
            {activeProject ? truncatePath(activeProject.path) : 'Abrir projeto…'}
          </span>
          <ChevronDownIcon className="size-3.5 shrink-0 text-(--color-text-faint)" />
        </button>

        {activeProject && (
          <div className="flex items-center gap-1.5 px-1.5">
            <span
              className={`size-1.5 rounded-full ${
                ragIndexed ? 'bg-(--color-accent-emerald)' : 'bg-(--color-text-faint)'
              }`}
              aria-hidden="true"
            />
            <span
              className={`font-mono text-(length:--text-2xs) ${
                ragIndexed ? 'text-(--color-accent-emerald)' : 'text-(--color-text-faint)'
              }`}
            >
              {ragIndexed ? 'RAG indexado' : 'RAG ocioso'}
            </span>
            {ragIndexed && (
              <span className="font-mono text-(length:--text-2xs) text-(--color-text-faint)">
                · {ragStats.indexedFiles} arquivos
              </span>
            )}
          </div>
        )}

        {/* Dropdown de projetos */}
        {projectDropdownOpen && (
          <div className="absolute left-2.5 right-2.5 top-full z-50 mt-1 rounded-(--radius-sm) border border-(--color-border) bg-(--color-surface) p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setProjectDropdownOpen(false)
                onOpenProjectDialog()
              }}
              className="flex w-full items-center gap-2 rounded-(--radius-xs) px-2 py-1.5 font-mono text-(length:--text-xs) text-(--color-accent-blue) hover:bg-(--color-surface-raised)"
            >
              <PlusIcon className="size-3" />
              <span>Abrir pasta do projeto...</span>
            </button>

            {projects.length > 0 && (
              <div className="mt-1 border-t border-(--color-border) pt-1">
                <div className="px-2 py-0.5 font-mono text-(length:--text-2xs) uppercase tracking-wider text-(--color-text-faint)">
                  Recentes
                </div>
                <div className="max-h-48 space-y-0.5 overflow-y-auto mt-0.5">
                  {projects.map((p) => {
                    const isCurrent = p.id === activeProject?.id
                    return (
                      <div
                        key={p.id}
                        className={`group flex items-center justify-between rounded-(--radius-xs) px-2 py-1 text-(length:--text-xs) transition-colors ${
                          isCurrent
                            ? 'bg-(--color-surface-raised) text-(--color-text) font-medium'
                            : 'text-(--color-text-muted) hover:bg-(--color-surface-raised) hover:text-(--color-text)'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setProjectDropdownOpen(false)
                            onSwitchProject(p.id)
                          }}
                          className="min-w-0 flex-1 truncate text-left"
                          title={p.path}
                        >
                          {p.name}
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            title="Remover da lista"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveProject(p.id)
                            }}
                            className="ml-1 opacity-0 group-hover:opacity-100 rounded px-1 font-mono text-(length:--text-2xs) text-(--color-text-faint) hover:text-(--color-accent-red)"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Busca FTS5 + nova sessão */}
      <div className="flex items-center gap-1.5 border-b border-(--color-border) px-3 py-2">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-(--color-text-faint)" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar conversas..."
            className="w-full rounded-(--radius-sm) border border-(--color-border) bg-(--color-bg) py-1 pl-7 pr-2 font-mono text-(length:--text-xs) text-(--color-text) placeholder:text-(--color-text-faint) focus:border-(--color-accent-blue) focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            onNewChat()
            onToggleMobile?.()
          }}
          disabled={!activeProject}
          className="flex size-7 shrink-0 items-center justify-center rounded-(--radius-sm) border border-(--color-border) text-(--color-text-muted) transition-colors hover:border-(--color-border-strong) hover:text-(--color-text) disabled:cursor-not-allowed disabled:opacity-40"
          title="Nova conversa"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>

      {/* Lista de sessões */}
      <nav className="flex-1 overflow-y-auto px-1.5 py-1.5" aria-label="Lista de conversas">
        {filteredSessions.length === 0 && (
          <p className="px-2 py-4 text-center text-(length:--text-xs) text-(--color-text-faint)">
            {activeProject ? 'Nenhuma conversa ainda' : 'Abra um projeto para começar'}
          </p>
        )}

        {/* Exibe sessão ativa se ainda não persistida no SQLite */}
        {activeTitle &&
          activeTitle !== 'Nova conversa' &&
          !sessions.some((s) => s.id === currentSessionId) && (
            <div className="flex items-center justify-between rounded-(--radius-sm) bg-(--color-surface-raised) px-2 py-1.5 text-left mb-1">
              <span className="truncate text-(length:--text-sm) text-(--color-text)">
                {activeTitle}
              </span>
              <span className="size-1.5 rounded-full bg-(--color-accent-blue) animate-pulse" />
            </div>
          )}

        <ul className="flex flex-col gap-0.5">
          {filteredSessions.map((session) => {
            const isActive = session.id === currentSessionId
            return (
              <li key={session.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSession(session.id)
                    onToggleMobile?.()
                  }}
                  className={`flex w-full flex-col gap-0.5 rounded-(--radius-sm) px-2 py-1.5 text-left transition-colors ${
                    isActive ? 'bg-(--color-surface-raised)' : 'hover:bg-(--color-surface)'
                  }`}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div className="flex items-center justify-between gap-2 pr-4">
                    <span
                      className={`truncate text-(length:--text-sm) ${
                        isActive ? 'text-(--color-text)' : 'text-(--color-text-muted)'
                      }`}
                    >
                      {session.title || 'Sem título'}
                    </span>
                    <span className="shrink-0 font-mono text-(length:--text-2xs) text-(--color-text-faint)">
                      {formatRelativeTime(session.updatedAt)}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  title="Excluir conversa"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeleteSession(session.id)
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 rounded px-1 font-mono text-(length:--text-2xs) text-(--color-text-faint) hover:text-(--color-accent-red)"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M11 11l3.5 3.5" strokeLinecap="round" />
    </svg>
  )
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>): ReactNode {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} {...props}>
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  )
}

export default Sidebar
