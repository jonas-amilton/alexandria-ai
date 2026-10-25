import { useEffect, useState, useMemo, type ReactNode } from 'react'

import type { CodeGraphData, CodeGraphNode, CodeGraphNodeType } from '../../../../../shared/graph'

interface CodeGraphModalProps {
  open: boolean
  onClose: () => void
  targetDir?: string
}

const TYPE_COLORS: Record<CodeGraphNodeType, { bg: string; text: string; border: string }> = {
  main: { bg: 'bg-blue-950/40', text: 'text-blue-400', border: 'border-blue-800/60' },
  agent: { bg: 'bg-purple-950/40', text: 'text-purple-400', border: 'border-purple-800/60' },
  renderer: { bg: 'bg-emerald-950/40', text: 'text-emerald-400', border: 'border-emerald-800/60' },
  component: { bg: 'bg-teal-950/40', text: 'text-teal-400', border: 'border-teal-800/60' },
  hook: { bg: 'bg-amber-950/40', text: 'text-amber-400', border: 'border-amber-800/60' },
  preload: { bg: 'bg-pink-950/40', text: 'text-pink-400', border: 'border-pink-800/60' },
  shared: { bg: 'bg-indigo-950/40', text: 'text-indigo-400', border: 'border-indigo-800/60' },
  config: { bg: 'bg-slate-950/40', text: 'text-slate-400', border: 'border-slate-800/60' },
  file: { bg: 'bg-gray-950/40', text: 'text-gray-400', border: 'border-gray-800/60' }
}

export default function CodeGraphModal({
  open,
  onClose,
  targetDir
}: CodeGraphModalProps): ReactNode {
  const [data, setData] = useState<CodeGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let disposed = false

    window.deepdesk.graph
      .build(targetDir)
      .then((res) => {
        if (!disposed) {
          setData(res)
          setLoading(false)
          if (res.nodes.length > 0) {
            // Default to entrypoint or first node
            setSelectedNodeId(res.stats.entryPoints[0] ?? res.nodes[0].id)
          }
        }
      })
      .catch(() => {
        if (!disposed) setLoading(false)
      })

    return () => {
      disposed = true
    }
  }, [open, targetDir])

  const filteredNodes = useMemo(() => {
    if (!data) return []
    const term = search.toLowerCase().trim()
    return data.nodes.filter((node) => {
      const matchSearch =
        term === '' ||
        node.id.toLowerCase().includes(term) ||
        node.exports.some((e) => e.toLowerCase().includes(term))
      const matchType = typeFilter === 'all' || node.type === typeFilter
      return matchSearch && matchType
    })
  }, [data, search, typeFilter])

  const selectedNode: CodeGraphNode | null = useMemo(() => {
    if (!data || !selectedNodeId) return null
    return data.nodes.find((n) => n.id === selectedNodeId) ?? null
  }, [data, selectedNodeId])

  const incomingDependents = useMemo(() => {
    if (!data || !selectedNodeId) return []
    return data.edges.filter((e) => e.target === selectedNodeId).map((e) => e.source)
  }, [data, selectedNodeId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
      <div className="flex h-[88vh] w-full max-w-5xl flex-col rounded-[12px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🕸️</span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">
                Grafo da Aplicação (CodeGraph)
              </h2>
              <p className="text-[10px] text-[var(--app-text-muted)]">
                Mapeamento estrutural de arquivos, conexões de dependência e símbolos exportados
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] p-1 text-[var(--app-text-muted)] hover:bg-[var(--app-panel-2)] hover:text-[var(--app-text)]"
          >
            ✕
          </button>
        </div>

        {/* Stats bar */}
        {data && (
          <div className="flex flex-wrap items-center gap-4 border-b border-[var(--app-border)] bg-[var(--app-panel-2)] px-5 py-2 text-[10px] text-[var(--app-text-muted)]">
            <div>
              <span className="text-[var(--app-text)] font-semibold">{data.stats.totalFiles}</span>{' '}
              arquivos mapeados
            </div>
            <div>
              <span className="text-[var(--app-text)] font-semibold">{data.stats.totalEdges}</span>{' '}
              conexões de import
            </div>
            <div>
              <span className="text-[var(--app-text)] font-semibold">
                {data.stats.entryPoints.length}
              </span>{' '}
              pontos de entrada
            </div>
            <div className="ml-auto text-[9px] text-[var(--app-text-soft)]">
              Raiz:{' '}
              <code className="text-[var(--app-accent)] truncate max-w-[200px] inline-block align-bottom">
                {data.rootDir}
              </code>
            </div>
          </div>
        )}

        {/* Search & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--app-border)] px-5 py-2.5">
          <input
            type="text"
            placeholder="Buscar arquivo ou símbolo exportado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 w-64 rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2.5 text-[11px] text-[var(--app-text)] placeholder:text-[var(--app-text-muted)] focus:border-[var(--app-accent)] focus:outline-hidden"
          />

          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            {['all', 'main', 'agent', 'renderer', 'shared', 'preload', 'component'].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-[5px] px-2 py-1 uppercase text-[9px] font-medium transition-colors ${
                  typeFilter === t
                    ? 'bg-[var(--app-accent)] text-white'
                    : 'bg-[var(--app-panel-2)] text-[var(--app-text-muted)] hover:text-[var(--app-text)]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content columns */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Nodes list */}
          <div className="w-1/2 border-r border-[var(--app-border)] overflow-y-auto p-3 space-y-1">
            {loading ? (
              <div className="py-12 text-center text-[11px] text-[var(--app-text-muted)]">
                Construindo grafo da aplicação...
              </div>
            ) : filteredNodes.length === 0 ? (
              <div className="py-12 text-center text-[11px] text-[var(--app-text-muted)]">
                Nenhum módulo encontrado com esse filtro.
              </div>
            ) : (
              filteredNodes.map((node) => {
                const isSelected = node.id === selectedNodeId
                const typeStyle = TYPE_COLORS[node.type] ?? TYPE_COLORS.file
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`w-full text-left rounded-[7px] p-2 text-[11px] transition-colors border ${
                      isSelected
                        ? 'border-[var(--app-accent)] bg-[var(--app-panel-2)] text-[var(--app-text)] shadow-xs'
                        : 'border-transparent hover:bg-[var(--app-panel-2)] text-[var(--app-text-soft)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-[11px] text-[var(--app-text)] truncate">
                        {node.id}
                      </div>
                      <span
                        className={`text-[8px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-[4px] border ${typeStyle.bg} ${typeStyle.text} ${typeStyle.border}`}
                      >
                        {node.type}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[9px] text-[var(--app-text-muted)]">
                      <span>{node.lines} linhas</span>
                      <span>{node.imports.length} imports</span>
                      <span>{node.exports.length} exports</span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Right: Selected Node Details & Connections */}
          <div className="w-1/2 overflow-y-auto p-5 bg-[var(--app-bg)]">
            {selectedNode ? (
              <div className="space-y-4">
                {/* Node header */}
                <div className="border-b border-[var(--app-border)] pb-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs font-bold text-[var(--app-text)]">
                      {selectedNode.id}
                    </h3>
                    <span
                      className={`text-[9px] uppercase px-2 py-0.5 rounded-[4px] border ${
                        TYPE_COLORS[selectedNode.type]?.bg
                      } ${TYPE_COLORS[selectedNode.type]?.text} ${
                        TYPE_COLORS[selectedNode.type]?.border
                      }`}
                    >
                      {selectedNode.type}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--app-text-muted)]">
                    Tamanho: {selectedNode.size} bytes • {selectedNode.lines} linhas
                  </div>
                </div>

                {/* Exported symbols */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-1.5">
                    Símbolos Exportados ({selectedNode.exports.length})
                  </div>
                  {selectedNode.exports.length === 0 ? (
                    <div className="text-[10px] text-[var(--app-text-muted)] italic">
                      Nenhum símbolo público exportado diretamente.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.exports.map((sym) => (
                        <span
                          key={sym}
                          className="rounded-[4px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-0.5 font-mono text-[9px] text-amber-300"
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Local Dependencies (Imports) */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-1.5">
                    Depende de ({selectedNode.imports.length} módulos locais)
                  </div>
                  {selectedNode.imports.length === 0 ? (
                    <div className="text-[10px] text-[var(--app-text-muted)] italic">
                      Não depende de outros arquivos locais.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {selectedNode.imports.map((dep) => (
                        <button
                          key={dep}
                          type="button"
                          onClick={() => setSelectedNodeId(dep)}
                          className="w-full text-left rounded-[5px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1 text-[10px] font-mono text-[var(--app-text-soft)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)] transition-colors flex items-center justify-between"
                        >
                          <span className="truncate">↳ {dep}</span>
                          <span className="text-[8px] text-[var(--app-text-muted)] ml-2">ir →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dependents (Imported by) */}
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-1.5">
                    Importado por ({incomingDependents.length} módulos)
                  </div>
                  {incomingDependents.length === 0 ? (
                    <div className="text-[10px] text-[var(--app-text-muted)] italic">
                      Nenhum outro arquivo local importa este módulo (possível entry point).
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {incomingDependents.map((dep) => (
                        <button
                          key={dep}
                          type="button"
                          onClick={() => setSelectedNodeId(dep)}
                          className="w-full text-left rounded-[5px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2.5 py-1 text-[10px] font-mono text-[var(--app-text-soft)] hover:border-[var(--app-accent)] hover:text-[var(--app-text)] transition-colors flex items-center justify-between"
                        >
                          <span className="truncate">⇠ {dep}</span>
                          <span className="text-[8px] text-[var(--app-text-muted)] ml-2">ir →</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* External packages */}
                {selectedNode.externalImports.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)] mb-1.5">
                      Pacotes Externos
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedNode.externalImports.map((pkg) => (
                        <span
                          key={pkg}
                          className="rounded-[4px] border border-[var(--app-border)] bg-[var(--app-panel)] px-2 py-0.5 font-mono text-[9px] text-[var(--app-text-muted)]"
                        >
                          {pkg}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-[var(--app-text-muted)]">
                Selecione um arquivo à esquerda para inspecionar conexões.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--app-border)] px-5 py-2.5 flex justify-end bg-[var(--app-panel-2)]">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] bg-[var(--app-accent)] px-3 py-1.5 text-[10px] font-medium text-white hover:bg-[var(--app-accent-hover)] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
