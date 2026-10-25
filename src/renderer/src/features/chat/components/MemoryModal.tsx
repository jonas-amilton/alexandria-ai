import { useEffect, useState, type ReactNode } from 'react'

interface MemoryModalProps {
  open: boolean
  onClose: () => void
  activeProjectPath?: string
  activeProjectName?: string
}

type TabType = 'user' | 'project'

export default function MemoryModal({
  open,
  onClose,
  activeProjectPath,
  activeProjectName
}: MemoryModalProps): ReactNode {
  const [activeTab, setActiveTab] = useState<TabType>('user')
  const [userProfileEntries, setUserProfileEntries] = useState<string[]>([])
  const [projectMemoryContent, setProjectMemoryContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingProjectMem, setSavingProjectMem] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    if (!open) return

    let disposed = false

    Promise.all([
      window.deepdesk.agent.inspect(),
      activeProjectPath
        ? window.deepdesk.projects.getMemory(activeProjectPath)
        : Promise.resolve('')
    ])
      .then(([inspectRes, mem]) => {
        if (!disposed) {
          setUserProfileEntries(inspectRes.memory.user ?? [])
          setProjectMemoryContent(mem)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!disposed) setLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [open, activeProjectPath])

  if (!open) return null

  const handleSaveProjectMemory = async (): Promise<void> => {
    if (!activeProjectPath) return
    try {
      setSavingProjectMem(true)
      await window.deepdesk.projects.saveMemory(activeProjectPath, projectMemoryContent)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      alert(`Erro ao salvar memória do projeto: ${String(err)}`)
    } finally {
      setSavingProjectMem(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--app-accent)]/15 text-base text-[var(--app-accent)]">
              🧠
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">
                Memória Persistente do Agente
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Preferências do usuário e convenções do repositório
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1.5 text-[var(--app-text-muted)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text)]"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[var(--app-border)] px-5 gap-6 bg-[var(--app-panel-2)]/50 text-[11px]">
          <button
            type="button"
            onClick={() => setActiveTab('user')}
            className={`py-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'user'
                ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                : 'border-transparent text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
            }`}
          >
            👤 Perfil do Usuário ({userProfileEntries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('project')}
            className={`py-2.5 font-medium border-b-2 transition-colors ${
              activeTab === 'project'
                ? 'border-[var(--app-accent)] text-[var(--app-accent)]'
                : 'border-transparent text-[var(--app-text-soft)] hover:text-[var(--app-text)]'
            }`}
          >
            📁 Memória do Projeto: {activeProjectName || 'Ativo'}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-full items-center justify-center text-[12px] text-[var(--app-text-muted)]">
              Carregando memórias...
            </div>
          ) : activeTab === 'user' ? (
            /* User profile list */
            <div className="space-y-4">
              <div className="rounded-[8px] border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-[var(--app-text-soft)] leading-relaxed">
                <span className="font-semibold text-blue-400">💡 Como funciona:</span> O agente
                grava aqui quem você é, preferências de estilo de código, idioma e instruções gerais
                que valem para todas as conversas e projetos (armazenado em <code>USER.md</code>).
              </div>

              {userProfileEntries.length === 0 ? (
                <div className="rounded-[8px] border border-dashed border-[var(--app-border)] p-6 text-center text-[11px] text-[var(--app-text-muted)]">
                  Nenhuma entrada no perfil do usuário ainda. O agente preenche automaticamente
                  conforme você compartilha preferências durante as conversas.
                </div>
              ) : (
                <ul className="space-y-2">
                  {userProfileEntries.map((entry, idx) => (
                    <li
                      key={idx}
                      className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)]/60 p-3 text-[11px] text-[var(--app-text)] leading-relaxed flex items-start gap-2.5"
                    >
                      <span className="text-[var(--app-accent)] font-semibold">•</span>
                      <span>{entry}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            /* Project memory editor */
            <div className="flex flex-col h-full space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-[var(--app-text-muted)]">
                    Local:{' '}
                    <code className="text-[var(--app-text)]">
                      {activeProjectPath}/.alexandria/MEMORY.md
                    </code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {saveSuccess && (
                    <span className="text-[10px] text-emerald-400 font-medium">
                      ✓ Salvo com sucesso!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveProjectMemory}
                    disabled={savingProjectMem || !activeProjectPath}
                    className="rounded-[6px] bg-[var(--app-accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:bg-[var(--app-accent-hover)] disabled:opacity-50"
                  >
                    {savingProjectMem ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>

              <textarea
                value={projectMemoryContent}
                onChange={(e) => setProjectMemoryContent(e.target.value)}
                placeholder="# Memória do Projeto&#10;&#10;Registre convenções de arquitetura, padrões e decisões deste repositório..."
                className="flex-1 w-full rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)]/60 p-3 font-mono text-[11px] leading-relaxed text-[var(--app-text)] resize-none focus:border-[var(--app-accent)] focus:outline-hidden"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
