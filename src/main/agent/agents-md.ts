import { randomUUID } from 'crypto'
import { mkdir, readFile, rename, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import * as electron from 'electron'

export const DEFAULT_AGENTS_MD = `# AGENTS.md — Global Agent Guidelines

## Persona & Core Principles
- You are Alexandria.AI, an autonomous senior software engineering agent.
- Prioritize concise, clear, and actionable answers without unnecessary flattery or conversational filler.
- Ground your analysis in actual repository code and architectural dependencies.

## Code Quality Standards
- Write clean, maintainable, modular, and self-documenting code.
- Prefer existing standard library and modern native platform features before adding external dependencies.
- Follow existing patterns and naming conventions in the repository.

## Safety & Verification
- Never delete or overwrite files without checking dependencies and preserving essential comments.
- Always verify your work with automated tests and typechecks before reporting completion.
`

function getAgentsMdPath(): string {
  const electronApp = (electron as unknown as { app?: typeof import('electron').app }).app
  if (electronApp?.getPath) {
    return join(electronApp.getPath('userData'), 'AGENTS.md')
  }
  return join(process.env.HOME || '/tmp', '.alexandria', 'AGENTS.md')
}

export async function readGlobalAgentsMd(): Promise<string> {
  const target = getAgentsMdPath()
  try {
    const content = await readFile(target, 'utf8')
    return content
  } catch (err) {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'ENOENT'
    ) {
      // Auto-initialize with default guidelines
      try {
        await saveGlobalAgentsMd(DEFAULT_AGENTS_MD)
      } catch {
        // ignore
      }
      return DEFAULT_AGENTS_MD
    }
    return DEFAULT_AGENTS_MD
  }
}

export async function saveGlobalAgentsMd(
  content: string
): Promise<{ ok: boolean; message?: string }> {
  const target = getAgentsMdPath()
  const dir = join(target, '..')
  let tmp: string | null = null

  try {
    await mkdir(dir, { recursive: true })
    tmp = `${target}.${randomUUID()}.tmp`
    await writeFile(tmp, content.trim(), { mode: 0o600, encoding: 'utf8' })
    await rename(tmp, target)
    return { ok: true }
  } catch (err) {
    if (tmp) {
      try {
        await unlink(tmp)
      } catch {
        // ignore
      }
    }
    return { ok: false, message: String(err instanceof Error ? err.message : err) }
  }
}
