import { readdir, readFile, stat } from 'fs/promises'
import { basename, dirname, extname, join, normalize, relative } from 'path'

import type {
  CodeGraphData,
  CodeGraphEdge,
  CodeGraphNode,
  CodeGraphNodeType,
  CodeGraphSummary
} from '../../shared/graph'

export type { CodeGraphData, CodeGraphEdge, CodeGraphNode, CodeGraphNodeType, CodeGraphSummary }

// ── Constants & Helpers ─────────────────────────────────────────────────────

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.cache',
  'coverage',
  '.gemini',
  '.system_generated',
  '.claude'
])

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'])

function classifyNodeType(relPath: string): CodeGraphNodeType {
  const norm = relPath.replace(/\\/g, '/')
  if (norm.includes('src/main/agent/')) return 'agent'
  if (norm.startsWith('src/main/')) return 'main'
  if (norm.startsWith('src/preload/')) return 'preload'
  if (norm.startsWith('src/shared/')) return 'shared'
  if (norm.includes('/hooks/') || norm.startsWith('src/renderer/src/hooks/')) return 'hook'
  if (norm.includes('/components/')) return 'component'
  if (norm.startsWith('src/renderer/')) return 'renderer'
  if (norm.endsWith('config.ts') || norm.endsWith('config.js') || norm.endsWith('.json')) {
    return 'config'
  }
  return 'file'
}

// Extract static imports, requires, and dynamic imports
function extractImportSpecifiers(content: string): string[] {
  const specifiers: string[] = []

  // import ... from '...' or import '...'
  const importRegex = /(?:import\s+(?:[\w*\s{},$]+from\s+)?|import\s*\(\s*)['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) specifiers.push(match[1])
  }

  // require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(content)) !== null) {
    if (match[1]) specifiers.push(match[1])
  }

  // export ... from '...'
  const exportFromRegex = /export\s+(?:[\w*\s{},$]+from\s+)['"]([^'"]+)['"]/g
  while ((match = exportFromRegex.exec(content)) !== null) {
    if (match[1]) specifiers.push(match[1])
  }

  return Array.from(new Set(specifiers))
}

// Extract exported symbols (functions, classes, consts, types)
function extractExportSymbols(content: string): string[] {
  const symbols: string[] = []

  const namedRegex =
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([a-zA-Z0-9_$]+)/g
  let match: RegExpExecArray | null
  while ((match = namedRegex.exec(content)) !== null) {
    if (match[1]) symbols.push(match[1])
  }

  // export default function/class without name or anonymous
  if (/export\s+default\s+/.test(content) && !symbols.includes('default')) {
    symbols.push('default')
  }

  // export { a, b, c }
  const exportBlockRegex = /export\s*\{([^}]+)\}/g
  while ((match = exportBlockRegex.exec(content)) !== null) {
    const parts = match[1].split(',')
    for (const part of parts) {
      const clean = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim()
      if (clean && /^[a-zA-Z0-9_$]+$/.test(clean)) {
        symbols.push(clean)
      }
    }
  }

  return Array.from(new Set(symbols)).slice(0, 30)
}

function resolveLocalImport(
  sourceRelPath: string,
  importSpec: string,
  existingFiles: Set<string>
): string | null {
  if (!importSpec.startsWith('.')) {
    return null
  }

  const sourceDir = dirname(sourceRelPath)
  const resolvedBase = normalize(join(sourceDir, importSpec)).replace(/\\/g, '/')

  // Candidate extensions
  const candidates = [
    resolvedBase,
    `${resolvedBase}.ts`,
    `${resolvedBase}.tsx`,
    `${resolvedBase}.js`,
    `${resolvedBase}.jsx`,
    `${resolvedBase}.mjs`,
    `${resolvedBase}.json`,
    `${resolvedBase}/index.ts`,
    `${resolvedBase}/index.tsx`,
    `${resolvedBase}/index.js`
  ]

  for (const candidate of candidates) {
    if (existingFiles.has(candidate)) {
      return candidate
    }
  }

  return null
}

async function collectFiles(dir: string, baseDir: string, results: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env') {
      continue
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue
      }
      await collectFiles(join(dir, entry.name), baseDir, results)
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (CODE_EXTENSIONS.has(ext)) {
        const fullPath = join(dir, entry.name)
        const rel = relative(baseDir, fullPath).replace(/\\/g, '/')
        results.push(rel)
      }
    }
  }
}

// ── Main Graph Builder ──────────────────────────────────────────────────────

export async function buildCodeGraph(targetDir?: string): Promise<CodeGraphData> {
  const root = targetDir ? normalize(targetDir) : process.cwd()
  const relFiles: string[] = []
  await collectFiles(root, root, relFiles)

  const fileSet = new Set(relFiles)
  const nodes: CodeGraphNode[] = []
  const edges: CodeGraphEdge[] = []
  const inDegreeMap = new Map<string, number>()
  const outDegreeMap = new Map<string, number>()

  for (const file of relFiles) {
    const fullPath = join(root, file)
    let content = ''
    let size = 0
    let lines = 0

    try {
      const s = await stat(fullPath)
      size = s.size
      content = await readFile(fullPath, 'utf8')
      lines = content.split('\n').length
    } catch {
      continue
    }

    const allImports = extractImportSpecifiers(content)
    const exports = extractExportSymbols(content)
    const localImports: string[] = []
    const externalImports: string[] = []

    for (const spec of allImports) {
      const resolved = resolveLocalImport(file, spec, fileSet)
      if (resolved && resolved !== file) {
        localImports.push(resolved)
        edges.push({ source: file, target: resolved })
        inDegreeMap.set(resolved, (inDegreeMap.get(resolved) ?? 0) + 1)
        outDegreeMap.set(file, (outDegreeMap.get(file) ?? 0) + 1)
      } else if (!spec.startsWith('.')) {
        externalImports.push(spec)
      }
    }

    nodes.push({
      id: file,
      label: basename(file),
      type: classifyNodeType(file),
      size,
      lines,
      imports: localImports,
      exports,
      externalImports: Array.from(new Set(externalImports)).slice(0, 20)
    })
  }

  // Identify entry points (inDegree === 0)
  const entryPoints = nodes
    .filter((n) => (inDegreeMap.get(n.id) ?? 0) === 0 && (outDegreeMap.get(n.id) ?? 0) > 0)
    .map((n) => n.id)

  // Identify top central modules (ranked by in-degree)
  const topCentralModules = nodes
    .map((n) => ({
      id: n.id,
      inDegree: inDegreeMap.get(n.id) ?? 0,
      outDegree: outDegreeMap.get(n.id) ?? 0
    }))
    .filter((m) => m.inDegree > 0)
    .sort((a, b) => b.inDegree - a.inDegree)
    .slice(0, 10)

  return {
    rootDir: root,
    nodes,
    edges,
    stats: {
      totalFiles: nodes.length,
      totalEdges: edges.length,
      entryPoints,
      topCentralModules
    }
  }
}

// ── Graph Query Helpers ─────────────────────────────────────────────────────

export function queryDependencies(
  graph: CodeGraphData,
  nodeId: string
): { node: CodeGraphNode | null; dependencies: CodeGraphNode[] } {
  const target = graph.nodes.find((n) => n.id === nodeId) ?? null
  if (!target) {
    return { node: null, dependencies: [] }
  }

  const depIds = new Set(target.imports)
  const dependencies = graph.nodes.filter((n) => depIds.has(n.id))
  return { node: target, dependencies }
}

export function queryDependents(
  graph: CodeGraphData,
  nodeId: string
): { node: CodeGraphNode | null; dependents: CodeGraphNode[] } {
  const target = graph.nodes.find((n) => n.id === nodeId) ?? null
  if (!target) {
    return { node: null, dependents: [] }
  }

  const dependentIds = new Set(graph.edges.filter((e) => e.target === nodeId).map((e) => e.source))
  const dependents = graph.nodes.filter((n) => dependentIds.has(n.id))
  return { node: target, dependents }
}

export function findDependencyPath(
  graph: CodeGraphData,
  fromId: string,
  toId: string
): string[] | null {
  if (fromId === toId) return [fromId]

  const adj = new Map<string, string[]>()
  for (const edge of graph.edges) {
    const list = adj.get(edge.source) ?? []
    list.push(edge.target)
    adj.set(edge.source, list)
  }

  const queue: string[][] = [[fromId]]
  const visited = new Set<string>([fromId])

  while (queue.length > 0) {
    const path = queue.shift()!
    const curr = path[path.length - 1]

    const neighbors = adj.get(curr) ?? []
    for (const neighbor of neighbors) {
      if (neighbor === toId) {
        return [...path, neighbor]
      }
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push([...path, neighbor])
      }
    }
  }

  return null
}
