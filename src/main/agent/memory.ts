import { randomUUID } from 'crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

import { app } from 'electron'

// Hermes' built-in memory is two plain-text files, not a database:
//   memories/MEMORY.md — agent notes (environment facts, conventions, lessons)
//   memories/USER.md   — user profile (identity, role, preferences, style)
// Entries are separated by the literal delimiter "\n§\n" and are bounded by
// character budgets, not tokens. The whole store is injected into the system
// prompt on every turn (there is no query-based retrieval).

export type MemoryTarget = 'memory' | 'user'

export interface MemorySnapshot {
  memory: string[]
  user: string[]
}

export interface MemoryLimits {
  memory: number
  user: number
}

export const MEMORY_LIMITS: MemoryLimits = {
  memory: 2200,
  user: 1375
}

const MEMORY_DIR = 'memories'
const ENTRY_SEPARATOR = '\n§\n'
const FILE_NAMES: Record<MemoryTarget, string> = {
  memory: 'MEMORY.md',
  user: 'USER.md'
}

export type MemoryMutation = { ok: true } | { ok: false; message: string }

function memoryDir(): string {
  return join(app.getPath('userData'), MEMORY_DIR)
}

function memoryFilePath(target: MemoryTarget): string {
  return join(memoryDir(), FILE_NAMES[target])
}

async function readEntries(target: MemoryTarget): Promise<string[]> {
  try {
    const raw = await readFile(memoryFilePath(target), 'utf8')

    return raw
      .split(ENTRY_SEPARATOR)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      return []
    }

    throw err
  }
}

function entryCount(entries: string[]): number {
  return entries.join(ENTRY_SEPARATOR).length
}

async function writeEntries(target: MemoryTarget, entries: string[]): Promise<void> {
  await mkdir(memoryDir(), { recursive: true })

  const filePath = memoryFilePath(target)
  const tmp = `${filePath}.${randomUUID()}.tmp`

  try {
    await writeFile(tmp, entries.join(ENTRY_SEPARATOR), { mode: 0o600 })
    await rename(tmp, filePath)
  } catch (err) {
    // best-effort cleanup
    try {
      await unlink(tmp)
    } catch {
      // ignore cleanup errors
    }

    throw err
  }
}

function overBudget(target: MemoryTarget, entries: string[]): boolean {
  return entryCount(entries) > MEMORY_LIMITS[target]
}

function budgetMessage(target: MemoryTarget, entries: string[]): string {
  const used = entryCount(entries)

  return `The ${target} memory is over its ${MEMORY_LIMITS[target]}-character budget (${used}). Consolidate or remove entries first, then retry in one batch.`
}

export async function loadMemorySnapshot(): Promise<MemorySnapshot> {
  const [memory, user] = await Promise.all([readEntries('memory'), readEntries('user')])

  return { memory, user }
}

export async function addMemory(target: MemoryTarget, content: string): Promise<MemoryMutation> {
  const entry = content.trim()

  if (entry.length === 0) {
    return { ok: false, message: 'Memory content cannot be empty.' }
  }

  const entries = await readEntries(target)

  // Hermes deduplicates exact entries.
  if (entries.includes(entry)) {
    return { ok: true }
  }

  const next = [...entries, entry]

  if (overBudget(target, next)) {
    return { ok: false, message: budgetMessage(target, next) }
  }

  await writeEntries(target, next)

  return { ok: true }
}

export async function patchMemory(
  target: MemoryTarget,
  oldText: string,
  content: string
): Promise<MemoryMutation> {
  const needle = oldText.trim()
  const replacement = content.trim()

  if (needle.length === 0) {
    return { ok: false, message: 'old_text cannot be empty.' }
  }

  if (replacement.length === 0) {
    return { ok: false, message: 'content cannot be empty.' }
  }

  const entries = await readEntries(target)
  const matches = entries.filter((entry) => entry.includes(needle))

  if (matches.length === 0) {
    return { ok: false, message: `No ${target} entry contains old_text.` }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      message: `old_text matches ${matches.length} ${target} entries; use a longer, unique span.`
    }
  }

  const index = entries.indexOf(matches[0])
  const next = [...entries]
  next[index] = entries[index].replace(needle, replacement)

  if (overBudget(target, next)) {
    return { ok: false, message: budgetMessage(target, next) }
  }

  await writeEntries(target, next)

  return { ok: true }
}

export async function removeMemory(target: MemoryTarget, oldText: string): Promise<MemoryMutation> {
  const needle = oldText.trim()

  if (needle.length === 0) {
    return { ok: false, message: 'old_text cannot be empty.' }
  }

  const entries = await readEntries(target)
  const matches = entries.filter((entry) => entry.includes(needle))

  if (matches.length === 0) {
    return { ok: false, message: `No ${target} entry contains old_text.` }
  }

  if (matches.length > 1) {
    return {
      ok: false,
      message: `old_text matches ${matches.length} ${target} entries; use a longer, unique span.`
    }
  }

  await writeEntries(
    target,
    entries.filter((entry) => entry !== matches[0])
  )

  return { ok: true }
}

export async function listMemory(target: MemoryTarget): Promise<string[]> {
  return readEntries(target)
}
