import { useEffect, useState, useCallback, type ReactNode } from 'react'

interface SkillItem {
  name: string
  description: string
  markdown: string
  body: string
}

interface SkillsModalProps {
  open: boolean
  onClose: () => void
}

export default function SkillsModal({ open, onClose }: SkillsModalProps): ReactNode {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [selectedSkillName, setSelectedSkillName] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Editor mode
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editContent, setEditContent] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const reloadSkills = useCallback(async (selectName?: string): Promise<void> => {
    try {
      const list = await window.deepdesk.skills.list()
      setSkills(list)
      if (selectName) {
        setSelectedSkillName(selectName)
      } else if (list.length > 0) {
        setSelectedSkillName((prev) => prev ?? list[0].name)
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    let disposed = false

    window.deepdesk.skills
      .list()
      .then((list) => {
        if (!disposed) {
          setSkills(list)
          if (list.length > 0) {
            setSelectedSkillName(list[0].name)
          }
          setLoading(false)
        }
      })
      .catch(() => {
        if (!disposed) setLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [open])

  if (!open) return null

  const selectedSkill = skills.find((s) => s.name === selectedSkillName)

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.description.toLowerCase().includes(search.toLowerCase())
  )

  const handleStartCreate = (): void => {
    setEditName('')
    setEditDescription('')
    setEditContent(`# Instruções da Skill\n\nDescreva passo a passo como o agente deve proceder...`)
    setIsEditing(true)
    setErrorMsg(null)
  }

  const handleStartEdit = (skill: SkillItem): void => {
    setEditName(skill.name)
    setEditDescription(skill.description)
    setEditContent(skill.body)
    setIsEditing(true)
    setErrorMsg(null)
  }

  const handleSave = async (): Promise<void> => {
    if (!editName.trim() || !editDescription.trim() || !editContent.trim()) {
      setErrorMsg('Preencha todos os campos.')
      return
    }

    try {
      setSaving(true)
      setErrorMsg(null)
      const res = await window.deepdesk.skills.save({
        name: editName.trim().toLowerCase(),
        description: editDescription.trim(),
        content: editContent.trim()
      })

      if (!res.ok) {
        setErrorMsg(res.message || 'Erro ao salvar skill.')
        return
      }

      setIsEditing(false)
      await reloadSkills(editName.trim().toLowerCase())
    } catch (err) {
      setErrorMsg(String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (name: string): Promise<void> => {
    if (!window.confirm(`Tem certeza que deseja arquivar a skill "${name}"?`)) return

    try {
      setLoading(true)
      await window.deepdesk.skills.delete(name)
      const nextSkills = skills.filter((s) => s.name !== name)
      setSkills(nextSkills)
      setSelectedSkillName(nextSkills[0]?.name ?? null)
    } catch (err) {
      alert(`Erro ao remover: ${String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="flex h-[82vh] w-full max-w-4xl flex-col rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-3 bg-[var(--app-panel)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--app-accent)]/15 text-base text-[var(--app-accent)]">
              ⚡
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">
                Gerenciador de Skills do Agente
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Procedimentos reutilizáveis e instruções especializadas (arquivos SKILL.md)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 rounded-[7px] bg-[var(--app-accent)] px-3 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[var(--app-accent-hover)]"
              >
                <span>+</span>
                <span>Nova Skill</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-[6px] p-1.5 text-[var(--app-text-muted)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text)]"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Skills Catalog */}
          <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-[var(--app-border)] bg-[var(--app-panel-2)]/40">
            {/* Search filter */}
            <div className="p-3 border-b border-[var(--app-border)]">
              <input
                type="text"
                placeholder="Buscar skills..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1.5 text-[11px] text-[var(--app-text)] placeholder-[var(--app-text-muted)] focus:border-[var(--app-accent)] focus:outline-hidden"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading && skills.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-[var(--app-text-muted)]">
                  Carregando skills...
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="p-4 text-center text-[11px] text-[var(--app-text-muted)]">
                  Nenhuma skill encontrada.
                </div>
              ) : (
                filteredSkills.map((skill) => {
                  const isSelected = selectedSkillName === skill.name && !isEditing
                  return (
                    <button
                      key={skill.name}
                      type="button"
                      onClick={() => {
                        setSelectedSkillName(skill.name)
                        setIsEditing(false)
                      }}
                      className={`w-full text-left p-2.5 rounded-[8px] transition-all border ${
                        isSelected
                          ? 'border-[var(--app-accent)]/50 bg-[var(--app-accent)]/10 text-[var(--app-text)]'
                          : 'border-transparent hover:bg-[var(--app-panel-2)] text-[var(--app-text-soft)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[11px] font-semibold text-[var(--app-text)]">
                          {skill.name}
                        </span>
                        <span className="text-[9px] text-[var(--app-text-muted)]">
                          {Math.round((skill.markdown.length / 1024) * 10) / 10} KB
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[10px] text-[var(--app-text-muted)] leading-tight">
                        {skill.description || 'Sem descrição'}
                      </p>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right: View or Edit Mode */}
          <div className="flex-1 flex flex-col bg-[var(--app-panel)] overflow-hidden">
            {isEditing ? (
              /* Create / Edit Form */
              <div className="flex flex-1 flex-col p-5 overflow-y-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">
                    {editName ? `Editar Skill: ${editName}` : 'Criar Nova Skill'}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="rounded-[6px] border border-[var(--app-border)] px-3 py-1 text-[11px] font-medium text-[var(--app-text-soft)] hover:bg-[var(--app-panel-2)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="rounded-[6px] bg-[var(--app-accent)] px-3 py-1 text-[11px] font-medium text-white hover:bg-[var(--app-accent-hover)] disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Salvar Skill'}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="rounded-[6px] border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-400">
                    {errorMsg}
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-medium text-[var(--app-text)] mb-1">
                    Nome da Skill (Slug único)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: code-refactoring, unit-tests, sql-optimizer"
                    value={editName}
                    onChange={(e) =>
                      setEditName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                    }
                    className="w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-1.5 font-mono text-[11px] text-[var(--app-text)] focus:border-[var(--app-accent)] focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-[var(--app-text)] mb-1">
                    Descrição Curta (Instrução para a IA saber quando ativar esta skill)
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Use when refactoring legacy React code to clean hooks and typescript."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-3 py-1.5 text-[11px] text-[var(--app-text)] focus:border-[var(--app-accent)] focus:outline-hidden"
                  />
                </div>

                <div className="flex-1 flex flex-col min-h-[220px]">
                  <label className="block text-[11px] font-medium text-[var(--app-text)] mb-1">
                    Corpo das Instruções (Markdown)
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Instruções completas em Markdown..."
                    className="flex-1 w-full rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-3 font-mono text-[11px] text-[var(--app-text)] resize-none focus:border-[var(--app-accent)] focus:outline-hidden"
                  />
                </div>
              </div>
            ) : selectedSkill ? (
              /* Skill Viewer */
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Header */}
                <div className="border-b border-[var(--app-border)] p-4 flex items-center justify-between bg-[var(--app-panel-2)]/20">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-semibold text-[var(--app-text)]">
                        {selectedSkill.name}
                      </span>
                      <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-medium text-emerald-400">
                        Ativa
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--app-text-soft)]">
                      {selectedSkill.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(selectedSkill)}
                      className="rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--app-text)] hover:bg-[var(--app-panel-2)]"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedSkill.name)}
                      className="rounded-[6px] border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/20"
                    >
                      🗑️ Arquivar
                    </button>
                  </div>
                </div>

                {/* Instructions viewer */}
                <div className="flex-1 overflow-y-auto p-5">
                  <div className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)]/40 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-3">
                      Instruções Executáveis (SKILL.md)
                    </div>
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--app-text)]">
                      {selectedSkill.body || selectedSkill.markdown}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-[12px] text-[var(--app-text-muted)]">
                Selecione uma skill ao lado para visualizar os detalhes ou clique em &quot;+ Nova
                Skill&quot;.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
