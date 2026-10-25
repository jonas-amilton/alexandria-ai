import { randomUUID } from 'crypto'
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

import { app } from 'electron'

// Hermes stores skills as directories containing a SKILL.md with YAML
// frontmatter (name, description) plus a Markdown body. This replica keeps the
// same on-disk format (flat, no category nesting) so skills remain portable and
// human-editable. Support files (references/, templates/, scripts/, assets/)
// are not replicated.

const SKILLS_DIR = 'skills'
const ARCHIVE_DIR = '.archive'
const SKILL_FILENAME = 'SKILL.md'
const MAX_NAME_LENGTH = 64
const MAX_DESCRIPTION_LENGTH = 1024
const MAX_SKILL_CHARS = 100_000

export interface SkillRecord {
  name: string
  description: string
  markdown: string
  body: string
}

export type SkillMutation = { ok: true } | { ok: false; message: string }

function skillsRoot(): string {
  return join(app.getPath('userData'), SKILLS_DIR)
}

function skillDir(name: string): string {
  return join(skillsRoot(), name)
}

function skillFilePath(name: string): string {
  return join(skillDir(name), SKILL_FILENAME)
}

export function isValidSkillName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && /^[a-z0-9][a-z0-9_-]*$/.test(name)
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'ENOENT'
  )
}

function splitFrontmatter(markdown: string): {
  fields: Record<string, string>
  body: string
} {
  const normalized = markdown.replace(/\r\n/g, '\n')

  if (!normalized.startsWith('---\n')) {
    return { fields: {}, body: normalized }
  }

  const end = normalized.indexOf('\n---\n', 4)

  if (end === -1) {
    return { fields: {}, body: normalized }
  }

  const fields: Record<string, string> = {}

  for (const line of normalized.slice(4, end).split('\n')) {
    const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(line)

    if (!match) {
      continue
    }

    let value = match[2].trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    fields[match[1]] = value
  }

  return { fields, body: normalized.slice(end + 5) }
}

function buildSkillMarkdown(name: string, description: string, body: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${body.trim()}\n`
}

async function readSkill(name: string): Promise<SkillRecord | null> {
  if (!isValidSkillName(name)) {
    return null
  }

  try {
    const markdown = await readFile(skillFilePath(name), 'utf8')
    const { fields, body } = splitFrontmatter(markdown)

    return {
      name: fields.name?.trim() || name,
      description: fields.description?.trim() || '',
      markdown,
      body
    }
  } catch (err) {
    if (isEnoent(err)) {
      return null
    }

    throw err
  }
}

async function writeSkill(name: string, markdown: string): Promise<void> {
  await mkdir(skillDir(name), { recursive: true })

  const target = skillFilePath(name)
  const tmp = `${target}.${randomUUID()}.tmp`

  try {
    await writeFile(tmp, markdown, { mode: 0o600 })
    await rename(tmp, target)
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

export async function listSkills(): Promise<SkillRecord[]> {
  let entries

  try {
    entries = await readdir(skillsRoot(), { withFileTypes: true })
  } catch (err) {
    if (isEnoent(err)) {
      return []
    }

    throw err
  }

  const skills = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => readSkill(entry.name))
  )

  return skills
    .filter((skill): skill is SkillRecord => skill !== null)
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function getSkill(name: string): Promise<SkillRecord | null> {
  return readSkill(name)
}

export async function createSkill(
  name: string,
  description: string,
  content: string
): Promise<SkillMutation> {
  if (!isValidSkillName(name)) {
    return {
      ok: false,
      message: 'Invalid skill name: use 1-64 lowercase letters, digits, hyphens, or underscores.'
    }
  }

  // Keep the frontmatter single-line and parseable.
  const cleanDescription = description.replace(/\s+/g, ' ').trim()
  const body = content.trim()

  if (cleanDescription.length === 0 || cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: `description must be between 1 and ${MAX_DESCRIPTION_LENGTH} characters.`
    }
  }

  if (body.length === 0) {
    return { ok: false, message: 'Skill content cannot be empty.' }
  }

  const markdown = buildSkillMarkdown(name, cleanDescription, body)

  if (markdown.length > MAX_SKILL_CHARS) {
    return { ok: false, message: `SKILL.md must be at most ${MAX_SKILL_CHARS} characters.` }
  }

  if ((await readSkill(name)) !== null) {
    return {
      ok: false,
      message: `Skill "${name}" already exists; use action="patch" to change it.`
    }
  }

  await writeSkill(name, markdown)

  return { ok: true }
}

export async function patchSkill(
  name: string,
  oldText: string,
  content: string
): Promise<SkillMutation> {
  const skill = await readSkill(name)

  if (skill === null) {
    return { ok: false, message: `No skill named "${name}".` }
  }

  const needle = oldText.trim()
  const replacement = content.trim()

  if (needle.length === 0 || replacement.length === 0) {
    return { ok: false, message: 'old_text and content cannot be empty.' }
  }

  const occurrences = skill.body.split(needle).length - 1

  if (occurrences === 0) {
    return { ok: false, message: 'old_text was not found in the skill body.' }
  }

  if (occurrences > 1) {
    return {
      ok: false,
      message: `old_text matches ${occurrences} places; use a longer, unique span.`
    }
  }

  const markdown = buildSkillMarkdown(
    skill.name,
    skill.description,
    skill.body.replace(needle, replacement)
  )

  if (markdown.length > MAX_SKILL_CHARS) {
    return { ok: false, message: `SKILL.md must be at most ${MAX_SKILL_CHARS} characters.` }
  }

  await writeSkill(name, markdown)

  return { ok: true }
}

export async function saveSkill(
  name: string,
  description: string,
  content: string
): Promise<SkillMutation> {
  if (!isValidSkillName(name)) {
    return {
      ok: false,
      message:
        'Skill name must be lowercase letters, digits, hyphen, or underscore, starting with letter or digit.'
    }
  }

  const cleanDescription = description.trim()
  if (cleanDescription.length === 0 || cleanDescription.length > MAX_DESCRIPTION_LENGTH) {
    return {
      ok: false,
      message: `Description must be 1 to ${MAX_DESCRIPTION_LENGTH} characters.`
    }
  }

  const markdown = buildSkillMarkdown(name, cleanDescription, content.trim())

  if (markdown.length > MAX_SKILL_CHARS) {
    return { ok: false, message: `SKILL.md must be at most ${MAX_SKILL_CHARS} characters.` }
  }

  await writeSkill(name, markdown)

  return { ok: true }
}

export async function deleteSkill(name: string): Promise<SkillMutation> {
  if (!isValidSkillName(name)) {
    return { ok: false, message: 'Invalid skill name.' }
  }

  const skill = await readSkill(name)

  if (skill === null) {
    return { ok: false, message: `No skill named "${name}".` }
  }

  // Hermes archives agent-created skills instead of deleting them outright.
  const archiveRoot = join(skillsRoot(), ARCHIVE_DIR)
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')

  await mkdir(archiveRoot, { recursive: true })
  await rename(skillDir(name), join(archiveRoot, `${name}-${stamp}`))

  return { ok: true }
}
