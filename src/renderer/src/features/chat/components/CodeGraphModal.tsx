import { useEffect, useState, useMemo, type ReactNode } from 'react'

import type { CodeGraphData, CodeGraphNode, CodeGraphNodeType } from '../../../../../shared/graph'

interface CodeGraphViewProps {
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

export function CodeGraphView({ targetDir }: CodeGraphViewProps): ReactNode {
  const [data, setData] = useState<CodeGraphData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    let disposed = false

    window.deepdesk.graph
      .build(targetDir)
      .then((res) => {
        if (!disposed) {
          setData(res)
          setLoading(false)
          if (res.nodes.length > 0) {
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
  }, [targetDir])

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

  const inDegreeMap = useMemo(() => {
    const map = new Map<string, number>()
    if (!data) return map
    for (const edge of data.edges) {
      map.set(edge.target, (map.get(edge.target) ?? 0) + 1)
    }
    return map
  }, [data])

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      {data && (
        <div className="flex flex-wrap items-center gap-4 border-b border-[var(--app-border)] bg-[var(--app-panel-2)]/40 px-5 py-2 text-[10px] text-[var(--app-text-muted)] font-mono">
          <div>
            <span className="text-[var(--app-text)] font-semibold">{data.stats.totalFiles}</span>{' '}
            arquivos
          </div>
          <div>
            <span className="text-[var(--app-text)] font-semibold">{data.stats.totalEdges}</span>{' '}
            conexões
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

      {/* Main split: File list & Node Inspector */}
      <div className="flex flex-1 overflow-hidden">
        {/* Node list */}
        <div className="w-[340px] flex-shrink-0 overflow-y-auto border-r border-[var(--app-border)] p-2">
          {loading ? (
            <div className="p-4 text-center text-xs text-[var(--app-text-muted)]">
              Analisando AST e escaneando dependências...
            </div>
          ) : filteredNodes.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--app-text-muted)]">
              Nenhum nó encontrado para o filtro.
            </div>
          ) : (
            <div className="space-y-1">
              {filteredNodes.map((node) => {
                const isSelected = node.id === selectedNodeId
                const typeStyle = TYPE_COLORS[node.type] ?? TYPE_COLORS.file

                return (
                  <div
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedNodeId(node.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setSelectedNodeId(node.id)
                    }}
                    className={`cursor-pointer rounded-[8px] p-2 transition-colors ${
                      isSelected
                        ? 'border border-[var(--app-accent)] bg-[var(--app-panel-2)]'
                        : 'border border-transparent hover:bg-[var(--app-panel-2)]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-mono text-[11px] font-medium text-[var(--app-text)]">
                        {node.id}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase ${typeStyle.bg} ${typeStyle.text} border ${typeStyle.border}`}
                      >
                        {node.type}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-[9px] text-[var(--app-text-muted)] font-mono">
                      <span>↓ {node.imports.length} imports</span>
                      <span>↑ {inDegreeMap.get(node.id) ?? 0} dependentes</span>
                      {node.exports.length > 0 && <span>⚡ {node.exports.length} exp</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected Node Details */}
        <div className="flex-1 overflow-y-auto p-5">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="border-b border-[var(--app-border)] pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm font-semibold text-[var(--app-text)]">
                    {selectedNode.id}
                  </h3>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[8px] font-semibold uppercase ${
                      (TYPE_COLORS[selectedNode.type] ?? TYPE_COLORS.file).bg
                    } ${(TYPE_COLORS[selectedNode.type] ?? TYPE_COLORS.file).text} border ${
                      (TYPE_COLORS[selectedNode.type] ?? TYPE_COLORS.file).border
                    }`}
                  >
                    {selectedNode.type}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-[var(--app-text-muted)]">
                  Caminho completo: {selectedNode.label || selectedNode.id}
                </p>
              </div>

              {/* Centrality Metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">
                    In-Degree (Impacto)
                  </div>
                  <div className="text-base font-semibold text-emerald-400 font-mono">
                    {incomingDependents.length}
                  </div>
                  <div className="text-[8px] text-[var(--app-text-soft)]">
                    arquivos dependem deste módulo
                  </div>
                </div>

                <div className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">
                    Out-Degree (Dependências)
                  </div>
                  <div className="text-base font-semibold text-blue-400 font-mono">
                    {selectedNode.imports.length}
                  </div>
                  <div className="text-[8px] text-[var(--app-text-soft)]">módulos importados</div>
                </div>

                <div className="rounded-[8px] border border-[var(--app-border)] bg-[var(--app-panel-2)] p-2.5">
                  <div className="text-[9px] uppercase tracking-wider text-[var(--app-text-muted)]">
                    Exportações
                  </div>
                  <div className="text-base font-semibold text-purple-400 font-mono">
                    {selectedNode.exports.length}
                  </div>
                  <div className="text-[8px] text-[var(--app-text-soft)]">
                    símbolos ou funções públicas
                  </div>
                </div>
              </div>

              {/* Exports List */}
              {selectedNode.exports.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[11px] font-semibold text-[var(--app-text)]">
                    Símbolos Exportados ({selectedNode.exports.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.exports.map((exp) => (
                      <span
                        key={exp}
                        className="rounded-[4px] border border-purple-800/40 bg-purple-950/20 px-2 py-0.5 font-mono text-[10px] text-purple-300"
                      >
                        {exp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Imports List */}
              <div>
                <h4 className="mb-1 text-[11px] font-semibold text-[var(--app-text)]">
                  Módulos Importados ({selectedNode.imports.length})
                </h4>
                {selectedNode.imports.length === 0 ? (
                  <p className="text-[10px] text-[var(--app-text-muted)]">
                    Nenhuma dependência local importada.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {selectedNode.imports.map((imp) => (
                      <button
                        key={imp}
                        type="button"
                        onClick={() => setSelectedNodeId(imp)}
                        className="w-full text-left rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2.5 py-1 font-mono text-[10px] text-blue-300 hover:border-[var(--app-accent)]"
                      >
                        → {imp}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dependents List */}
              <div>
                <h4 className="mb-1 text-[11px] font-semibold text-[var(--app-text)]">
                  Dependentes / Quem importa este arquivo ({incomingDependents.length})
                </h4>
                {incomingDependents.length === 0 ? (
                  <p className="text-[10px] text-[var(--app-text-muted)]">
                    Nenhum outro arquivo local depende deste diretamente (possível entry-point ou
                    folha).
                  </p>
                ) : (
                  <div className="space-y-1">
                    {incomingDependents.map((dep) => (
                      <button
                        key={dep}
                        type="button"
                        onClick={() => setSelectedNodeId(dep)}
                        className="w-full text-left rounded-[6px] border border-[var(--app-border)] bg-[var(--app-panel-2)] px-2.5 py-1 font-mono text-[10px] text-emerald-300 hover:border-[var(--app-accent)]"
                      >
                        ← {dep}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-[var(--app-text-muted)]">
              Selecione um arquivo à esquerda para inspecionar métricas e dependências.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface CodeGraphModalProps {
  open: boolean
  onClose: () => void
  targetDir?: string
}

export default function CodeGraphModal({
  open,
  onClose,
  targetDir
}: CodeGraphModalProps): ReactNode {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="flex h-[82vh] w-full max-w-4xl flex-col rounded-[14px] border border-[var(--app-border)] bg-[var(--app-panel)] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-[var(--app-border)] px-5 py-3 bg-[var(--app-panel)]">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-[var(--app-accent)]/15 text-base text-[var(--app-accent)]">
              🕸️
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--app-text)]">
                CodeGraph: Arquitetura & Dependências
              </h2>
              <p className="text-[11px] text-[var(--app-text-muted)]">
                Mapa de módulos, fluxo de dependências e métricas de centralidade
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
        <CodeGraphView targetDir={targetDir} />
      </div>
    </div>
  )
}
