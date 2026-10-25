import { useState, useRef, useEffect, type ReactNode } from 'react'

import type { SessionItem } from '../../../../../shared/chat'
import type { ProjectRecord } from '../../../../../shared/projects'
import type { RagIndexStats } from '../../../../../shared/rag'

interface SidebarProps {
  currentSessionId: string
  activeTitle: string
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
  onOpenMemoryModal: () => void
  onOpenSkillsModal: () => void
  onOpenGraphModal: () => void
  onOpenSettingsModal: () => void
}

function Sidebar({
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
  onRemoveProject,
  onOpenMemoryModal,
  onOpenSkillsModal,
  onOpenGraphModal,
  onOpenSettingsModal
}: SidebarProps): ReactNode {
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProjectDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <aside className="flex h-full w-[230px] flex-shrink-0 flex-col border-r border-[var(--app-border)] bg-[var(--app-panel)] px-3 pt-3">
      {/* Branding */}
      <div className="flex items-center gap-2">
        <div className="flex h-[24px] w-[24px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[var(--app-accent)] text-[11px] font-semibold text-white">
          A
        </div>
        <div>
          <div className="text-[13px] font-medium text-[var(--app-text)]">Alexandria.AI</div>
          <div className="text-[9px] text-[var(--app-text-muted)]">Agente independente</div>
        </div>
      </div>

      {/* Project Selector */}
      <div className="relative mt-3" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setProjectDropdownOpen((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)]/70 px-2.5 py-1.5 text-left transition-colors hover:border-[var(--app-accent)]"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">📁</span>
              <span className="truncate text-[11px] font-semibold text-[var(--app-text)]">
                {activeProject?.name || 'Projeto Padrão'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[9px] text-[var(--app-text-muted)] truncate">
              {ragStats && ragStats.indexedFiles > 0 ? (
                <span className="text-emerald-400 font-mono">⚡ {ragStats.indexedFiles} arqs</span>
              ) : (
                <span className="truncate">{activeProject?.path || ''}</span>
              )}
            </div>
          </div>
          <span className="ml-1 text-[10px] text-[var(--app-text-muted)]">▾</span>
        </button>

        {/* Project Dropdown Menu */}
        {projectDropdownOpen && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel)] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setProjectDropdownOpen(false)
                onOpenProjectDialog()
              }}
              className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-[10px] font-medium text-[var(--app-accent)] hover:bg-[var(--app-panel-2)]"
            >
              <span>+</span>
              <span>Abrir Pasta do Projeto...</span>
            </button>

            {projects.length > 0 && (
              <div className="mt-1 border-t border-[var(--app-border)] pt-1">
                <div className="px-2 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                  Projetos Recentes
                </div>
                <div className="max-h-[160px] overflow-y-auto space-y-0.5 mt-0.5">
                  {projects.map((p) => {
                    const isCurrent = p.id === activeProject?.id
                    return (
                      <div
                        key={p.id}
                        className={`group flex items-center justify-between rounded-[6px] px-2 py-1 text-[10px] transition-colors ${
                          isCurrent
                            ? 'bg-[var(--app-accent)]/15 text-[var(--app-accent)] font-medium'
                            : 'text-[var(--app-text-soft)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text)]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setProjectDropdownOpen(false)
                            onSwitchProject(p.id)
                          }}
                          className="min-w-0 flex-1 text-left truncate flex items-center gap-1.5"
                        >
                          <span className="text-[10px]">📁</span>
                          <span className="truncate">{p.name}</span>
                        </button>
                        {projects.length > 1 && (
                          <button
                            type="button"
                            title="Remover da lista de recentes"
                            onClick={(e) => {
                              e.stopPropagation()
                              onRemoveProject(p.id)
                            }}
                            className="ml-1 opacity-0 group-hover:opacity-100 rounded px-1 text-[9px] text-[var(--app-text-muted)] hover:text-red-400"
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

      {/* New conversation button */}
      <button
        type="button"
        aria-label="Nova conversa"
        className="mt-3 flex h-8 w-full items-center justify-start gap-1.5 rounded-[8px] bg-[var(--app-accent)] px-3 text-[11px] font-medium text-white transition-colors hover:bg-[var(--app-accent-hover)]"
        onClick={() => {
          onNewChat()
          onToggleMobile?.()
        }}
      >
        <span className="text-base leading-none">+</span>
        <span>Nova conversa</span>
      </button>

      {/* Tools & Inspect quick access (4 buttons grid) */}
      <div className="mt-3 grid grid-cols-4 gap-1 border-b border-[var(--app-border)] pb-3">
        <button
          type="button"
          onClick={() => {
            onOpenMemoryModal()
            onToggleMobile?.()
          }}
          title="Memória Persistente (USER.md e MEMORY.md)"
          className="flex flex-col items-center justify-center gap-0.5 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] py-1.5 text-[8px] font-medium text-[var(--app-text-soft)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
        >
          <span className="text-[11px]">🧠</span>
          <span>Memória</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenSkillsModal()
            onToggleMobile?.()
          }}
          title="Gerenciador de Skills"
          className="flex flex-col items-center justify-center gap-0.5 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] py-1.5 text-[8px] font-medium text-[var(--app-text-soft)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
        >
          <span className="text-[11px]">⚡</span>
          <span>Skills</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenGraphModal()
            onToggleMobile?.()
          }}
          title="CodeGraph do Projeto"
          className="flex flex-col items-center justify-center gap-0.5 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] py-1.5 text-[8px] font-medium text-[var(--app-text-soft)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
        >
          <span className="text-[11px]">🕸️</span>
          <span>Grafo</span>
        </button>
        <button
          type="button"
          onClick={() => {
            onOpenSettingsModal()
            onToggleMobile?.()
          }}
          title="Configurações de Modelos e MCP"
          className="flex flex-col items-center justify-center gap-0.5 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] py-1.5 text-[8px] font-medium text-[var(--app-text-soft)] transition-colors hover:border-[var(--app-accent)] hover:text-[var(--app-text)]"
        >
          <span className="text-[11px]">⚙️</span>
          <span>Config</span>
        </button>
      </div>

      {/* Conversations label */}
      <div className="mt-3 flex items-center justify-between text-[8px] font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
        <span>Conversas deste Projeto ({sessions.length})</span>
      </div>

      {/* Conversation list */}
      <nav className="mt-2 flex flex-1 flex-col gap-1 overflow-y-auto pr-1">
        {/* If current conversation is not yet saved in SQLite list */}
        {activeTitle !== 'Nova conversa' && !sessions.some((s) => s.id === currentSessionId) ? (
          <div className="flex items-center justify-between rounded-[8px] bg-[var(--app-panel-2)] px-2.5 py-2 text-[10px] text-[var(--app-text)]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[var(--app-accent)] animate-pulse" />
              <span className="truncate">{activeTitle}</span>
            </div>
          </div>
        ) : null}

        {sessions.map((session) => {
          const isActive = session.id === currentSessionId
          return (
            <div
              key={session.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                onSelectSession(session.id)
                onToggleMobile?.()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSelectSession(session.id)
                  onToggleMobile?.()
                }
              }}
              className={`group flex items-center justify-between rounded-[8px] px-2.5 py-2 text-[10px] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[var(--app-panel-2)] text-[var(--app-text)] font-medium'
                  : 'text-[var(--app-text-muted)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text-soft)]'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-[5px] w-[5px] flex-shrink-0 rounded-full ${
                    isActive ? 'bg-[var(--app-accent)]' : 'bg-transparent'
                  }`}
                />
                <span className="truncate">{session.title}</span>
              </div>
              <button
                type="button"
                aria-label="Excluir conversa"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteSession(session.id)
                }}
                className="opacity-0 group-hover:opacity-100 rounded-[4px] p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-panel)] hover:text-red-400 transition-opacity"
              >
                ✕
              </button>
            </div>
          )
        })}

        {sessions.length === 0 && activeTitle === 'Nova conversa' && (
          <div className="p-4 text-center text-[10px] text-[var(--app-text-muted)]">
            Nenhuma conversa salva neste projeto.
          </div>
        )}
      </nav>

      {/* Footer Branding */}
      <div className="border-t border-[var(--app-border)] py-2 text-center text-[9px] text-[var(--app-text-muted)]">
        Alexandria v1.0 • Desktop Standalone
      </div>
    </aside>
  )
}

export default Sidebar
