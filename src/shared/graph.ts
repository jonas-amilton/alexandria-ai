export type CodeGraphNodeType =
  | 'main'
  | 'renderer'
  | 'agent'
  | 'preload'
  | 'shared'
  | 'component'
  | 'hook'
  | 'config'
  | 'file'

export interface CodeGraphNode {
  id: string
  label: string
  type: CodeGraphNodeType
  size: number
  lines: number
  imports: string[]
  exports: string[]
  externalImports: string[]
}

export interface CodeGraphEdge {
  source: string
  target: string
}

export interface CodeGraphSummary {
  totalFiles: number
  totalEdges: number
  entryPoints: string[]
  topCentralModules: Array<{ id: string; inDegree: number; outDegree: number }>
}

export interface CodeGraphData {
  rootDir: string
  nodes: CodeGraphNode[]
  edges: CodeGraphEdge[]
  stats: CodeGraphSummary
}
