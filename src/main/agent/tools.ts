import { z } from 'zod'

import type { ToolDefinition } from '../chat-completions'
import {
  addMemory,
  listMemory,
  MEMORY_LIMITS,
  patchMemory,
  removeMemory,
  type MemoryTarget
} from './memory'
import { searchSessions } from './sessions'
import { createSkill, deleteSkill, getSkill, listSkills, patchSkill } from './skills'
import {
  buildCodeGraph,
  findDependencyPath,
  queryDependencies,
  queryDependents
} from '../graph/codegraph'
import { searchRag } from '../rag/indexer'
import { mcpManager } from '../mcp/manager'

// ── Tool schemas ──────────────────────────────────────────────────────────

const MemoryArgs = z.object({
  action: z
    .enum(['add', 'patch', 'remove', 'list'])
    .describe(
      'add = append an entry; patch = replace one unique span; remove = delete one entry; list = show entries.'
    ),
  target: z
    .enum(['memory', 'user'])
    .optional()
    .default('memory')
    .describe(
      'user = who the user is (identity, role, preferences, style); memory = environment facts, conventions, lessons.'
    ),
  content: z.string().max(4000).optional().describe('Required for add and patch.'),
  old_text: z
    .string()
    .max(2000)
    .optional()
    .describe('Required for patch and remove; must match exactly one entry.')
})

const SkillViewArgs = z.object({
  name: z.string().min(1).max(64).describe('Skill name.')
})

const SessionSearchArgs = z.object({
  query: z
    .string()
    .min(1)
    .max(300)
    .describe('Keywords to find in past user and assistant messages.'),
  limit: z.number().int().min(1).max(20).optional().describe('Maximum results (default 5).')
})

const CodegraphArgs = z.object({
  action: z
    .enum(['overview', 'dependencies', 'dependents', 'trace'])
    .default('overview')
    .describe(
      'overview = whole project architecture, entrypoints, and central modules; dependencies = modules that target file imports; dependents = files that import target file; trace = find import path between from_file and to_file.'
    ),
  target_dir: z
    .string()
    .optional()
    .describe('Optional root directory to scan (defaults to application root).'),
  file: z
    .string()
    .optional()
    .describe('Target file path (relative to root) for dependencies or dependents query.'),
  from_file: z.string().optional().describe('Source file path for trace action.'),
  to_file: z.string().optional().describe('Destination file path for trace action.')
})

const RagSearchArgs = z.object({
  query: z
    .string()
    .min(1)
    .max(500)
    .describe(
      'Keywords, functions, symbols, or topics to search in the active project codebase to prevent hallucination.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .default(5)
    .describe('Maximum code snippets to retrieve.')
})

const SkillManageArgs = z.object({
  action: z.enum(['create', 'patch', 'delete']).describe('Operation to perform.'),
  name: z
    .string()
    .min(1)
    .max(64)
    .describe('Slug-like skill name (lowercase letters, digits, -, _).'),
  description: z
    .string()
    .max(1024)
    .optional()
    .describe('Required for create: one-line description shown in the skill index.'),
  content: z
    .string()
    .max(100_000)
    .optional()
    .describe('Required for create and patch: self-contained Markdown instructions.'),
  old_text: z
    .string()
    .max(4000)
    .optional()
    .describe('Required for patch: the exact span to replace in the skill body.')
})

function schemaFor(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>

  delete json.$schema

  return json
}

function toolDefinition(name: string, description: string, schema: z.ZodType): ToolDefinition {
  return {
    type: 'function',
    function: { name, description, parameters: schemaFor(schema) }
  }
}

export const AGENT_TOOLS: ToolDefinition[] = [
  toolDefinition(
    'memory',
    'Manage persistent memory. Use target="user" for who the user is (identity, role, preferences, communication style) and target="memory" for environment facts, conventions, and lessons. Memory is injected into the system prompt on every turn, so keep entries short and atomic. Never store passwords, API keys, tokens, or other secrets.',
    MemoryArgs
  ),
  toolDefinition(
    'skills_list',
    'List installed skills with their names and one-line descriptions.',
    z.object({})
  ),
  toolDefinition(
    'skill_view',
    'Load the full content of a skill before applying it. Skills are reusable procedures stored as SKILL.md files.',
    SkillViewArgs
  ),
  toolDefinition(
    'skill_manage',
    'Create, patch, or delete a reusable skill. Prefer patching an existing relevant skill over creating a new one; create a new skill only for a genuinely reusable procedure, not for one-off session artifacts. Deleting archives the skill instead of removing it.',
    SkillManageArgs
  ),
  toolDefinition(
    'session_search',
    'Search past conversations by keyword. Use it to recall prior discussions, decisions, or details that are not in memory. It returns raw matching messages with their conversation title and timestamp.',
    SessionSearchArgs
  ),
  toolDefinition(
    'current_time',
    'Return the current local date and time, including the timezone.',
    z.object({})
  ),
  toolDefinition(
    'codegraph',
    'Inspect and query the code architecture graph of the codebase (like codegraph/ast dependency mapping). Inspect module relationships, imports, exports, and call/import chains without scanning entire files manually.',
    CodegraphArgs
  ),
  toolDefinition(
    'rag_search',
    'Search the active project codebase using local SQLite FTS5 + BM25 retrieval. Use this tool BEFORE answering questions about code, APIs, configuration, or features to verify exact file contents and line numbers, preventing hallucinations.',
    RagSearchArgs
  )
]

// ── Execution ─────────────────────────────────────────────────────────────

export interface ToolResult {
  content: string
  isError: boolean
}

type ParsedArgs<T> = { ok: true; value: T } | { ok: false; message: string }

function parseArgs<T>(schema: z.ZodType<T>, raw: string): ParsedArgs<T> {
  let parsed: unknown

  try {
    parsed = raw.trim().length > 0 ? JSON.parse(raw) : {}
  } catch {
    return { ok: false, message: 'Invalid JSON arguments.' }
  }

  const result = schema.safeParse(parsed)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'arguments'}: ${issue.message}`)
      .join('; ')

    return { ok: false, message: `Invalid arguments: ${details}` }
  }

  return { ok: true, value: result.data }
}

function ok(content: string): ToolResult {
  return { content, isError: false }
}

function fail(message: string): ToolResult {
  return { content: message, isError: true }
}

async function runMemoryTool(rawArguments: string): Promise<ToolResult> {
  const parsed = parseArgs(MemoryArgs, rawArguments)

  if (!parsed.ok) {
    return fail(parsed.message)
  }

  const { action, target, content, old_text } = parsed.value
  const memoryTarget: MemoryTarget = target

  if (action === 'list') {
    const entries = await listMemory(memoryTarget)
    const used = entries.join('\n§\n').length

    return ok(
      JSON.stringify(
        {
          target: memoryTarget,
          used,
          limit: MEMORY_LIMITS[memoryTarget],
          entries
        },
        null,
        2
      )
    )
  }

  if (action === 'add') {
    if (!content || content.trim().length === 0) {
      return fail('content is required for action="add".')
    }

    const result = await addMemory(memoryTarget, content)

    return result.ok ? ok(`Added memory entry to ${memoryTarget}.`) : fail(result.message)
  }

  if (action === 'patch') {
    if (!old_text || !content) {
      return fail('old_text and content are required for action="patch".')
    }

    const result = await patchMemory(memoryTarget, old_text, content)

    return result.ok ? ok(`Patched memory entry in ${memoryTarget}.`) : fail(result.message)
  }

  if (!old_text) {
    return fail('old_text is required for action="remove".')
  }

  const result = await removeMemory(memoryTarget, old_text)

  return result.ok ? ok(`Removed memory entry from ${memoryTarget}.`) : fail(result.message)
}

async function runSkillManage(rawArguments: string): Promise<ToolResult> {
  const parsed = parseArgs(SkillManageArgs, rawArguments)

  if (!parsed.ok) {
    return fail(parsed.message)
  }

  const { action, name, description, content, old_text } = parsed.value

  if (action === 'create') {
    if (!description || !content) {
      return fail('description and content are required for action="create".')
    }

    const result = await createSkill(name, description, content)

    return result.ok ? ok(`Skill "${name}" created.`) : fail(result.message)
  }

  if (action === 'patch') {
    if (!old_text || !content) {
      return fail('old_text and content are required for action="patch".')
    }

    const result = await patchSkill(name, old_text, content)

    return result.ok ? ok(`Skill "${name}" patched.`) : fail(result.message)
  }

  const result = await deleteSkill(name)

  return result.ok ? ok(`Skill "${name}" archived.`) : fail(result.message)
}

async function runCodegraph(rawArguments: string): Promise<ToolResult> {
  const parsed = parseArgs(CodegraphArgs, rawArguments)

  if (!parsed.ok) {
    return fail(parsed.message)
  }

  const { action, target_dir, file, from_file, to_file } = parsed.value

  try {
    const graph = await buildCodeGraph(target_dir)

    if (action === 'overview') {
      return ok(
        JSON.stringify(
          {
            rootDir: graph.rootDir,
            stats: graph.stats,
            topFiles: graph.nodes.slice(0, 15).map((n) => ({
              id: n.id,
              type: n.type,
              lines: n.lines,
              importsCount: n.imports.length,
              exportsCount: n.exports.length
            }))
          },
          null,
          2
        )
      )
    }

    if (action === 'dependencies') {
      if (!file) return fail('file is required for action="dependencies"')
      const result = queryDependencies(graph, file)
      if (!result.node) return fail(`File "${file}" not found in graph.`)
      return ok(
        JSON.stringify(
          {
            file: result.node.id,
            type: result.node.type,
            exports: result.node.exports,
            externalImports: result.node.externalImports,
            localDependencies: result.dependencies.map((d) => ({ id: d.id, type: d.type }))
          },
          null,
          2
        )
      )
    }

    if (action === 'dependents') {
      if (!file) return fail('file is required for action="dependents"')
      const result = queryDependents(graph, file)
      if (!result.node) return fail(`File "${file}" not found in graph.`)
      return ok(
        JSON.stringify(
          {
            file: result.node.id,
            importedBy: result.dependents.map((d) => ({ id: d.id, type: d.type }))
          },
          null,
          2
        )
      )
    }

    if (action === 'trace') {
      if (!from_file || !to_file) {
        return fail('from_file and to_file are required for action="trace"')
      }
      const path = findDependencyPath(graph, from_file, to_file)
      return ok(
        path
          ? `Import path: ${path.join(' -> ')}`
          : `No import path found between "${from_file}" and "${to_file}".`
      )
    }

    return fail(`Unknown action: ${action}`)
  } catch (err) {
    return fail(`Failed to build code graph: ${String(err)}`)
  }
}

export async function executeAgentTool(
  name: string,
  rawArguments: string,
  context?: { projectId?: string }
): Promise<ToolResult> {
  switch (name) {
    case 'memory':
      return runMemoryTool(rawArguments)

    case 'skills_list': {
      const skills = await listSkills()

      if (skills.length === 0) {
        return ok('No skills saved yet.')
      }

      return ok(
        JSON.stringify(
          skills.map((skill) => ({
            name: skill.name,
            description: skill.description
          })),
          null,
          2
        )
      )
    }

    case 'skill_view': {
      const parsed = parseArgs(SkillViewArgs, rawArguments)

      if (!parsed.ok) {
        return fail(parsed.message)
      }

      const skill = await getSkill(parsed.value.name)

      if (skill === null) {
        return fail(`No skill named "${parsed.value.name}".`)
      }

      return ok(
        JSON.stringify(
          {
            name: skill.name,
            description: skill.description,
            content: skill.markdown
          },
          null,
          2
        )
      )
    }

    case 'skill_manage':
      return runSkillManage(rawArguments)

    case 'session_search': {
      const parsed = parseArgs(SessionSearchArgs, rawArguments)

      if (!parsed.ok) {
        return fail(parsed.message)
      }

      const results = searchSessions(parsed.value.query, parsed.value.limit ?? 5)

      return ok(
        results.length > 0 ? JSON.stringify(results, null, 2) : 'No matching past messages.'
      )
    }

    case 'current_time': {
      const now = new Date()

      return ok(
        `Local: ${now.toString()}\nISO: ${now.toISOString()}\nTimezone: ${
          Intl.DateTimeFormat().resolvedOptions().timeZone
        }`
      )
    }

    case 'codegraph':
      return runCodegraph(rawArguments)

    case 'rag_search': {
      const parsed = parseArgs(RagSearchArgs, rawArguments)
      if (!parsed.ok) {
        return fail(parsed.message)
      }

      const results = searchRag(
        context?.projectId ?? 'default',
        parsed.value.query,
        parsed.value.limit ?? 5
      )

      if (results.length === 0) {
        return ok('Nenhum trecho de código relevante encontrado pelo RAG para a busca informada.')
      }

      const formatted = results
        .map(
          (r, idx) =>
            `--- Snippet ${idx + 1} (${r.filePath}:${r.startLine}-${r.endLine}) ---\n${r.snippet}`
        )
        .join('\n\n')

      return ok(formatted)
    }

    default: {
      if (mcpManager.isMcpTool(name)) {
        try {
          let parsed: Record<string, unknown> = {}
          try {
            parsed = rawArguments.trim().length > 0 ? JSON.parse(rawArguments) : {}
          } catch {
            return fail('Invalid JSON arguments for MCP tool.')
          }
          const mcpResult = await mcpManager.executeTool(name, parsed)
          return ok(mcpResult)
        } catch (err) {
          return fail(`MCP execution error: ${String(err)}`)
        }
      }

      const available = AGENT_TOOLS.map((tool) => tool.function.name).join(', ')

      return fail(`Tool "${name}" does not exist. Available tools: ${available}.`)
    }
  }
}
