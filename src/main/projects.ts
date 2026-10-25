import { createHash } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'fs/promises'
import { basename, join, resolve } from 'path'

import { app, dialog, BrowserWindow } from 'electron'

import type { ProjectRecord, ProjectsState } from '../shared/projects'

const PROJECTS_CONFIG_FILE = 'projects.json'
const ALEXANDRIA_DIR = '.alexandria'
const MEMORY_FILE = 'MEMORY.md'
const MCP_FILE = 'mcp.json'

function projectsConfigPath(): string {
  return join(app.getPath('userData'), PROJECTS_CONFIG_FILE)
}

function computeProjectId(folderPath: string): string {
  const normalized = resolve(folderPath).toLowerCase()
  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

interface StoredProjectsConfig {
  activeProjectId: string
  projects: ProjectRecord[]
}

export async function ensureAlexandriaDirectory(projectPath: string): Promise<void> {
  const dir = join(projectPath, ALEXANDRIA_DIR)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const memoryPath = join(dir, MEMORY_FILE)
  if (!existsSync(memoryPath)) {
    const defaultMemory = `# Memória do Projeto: ${basename(projectPath)}

## Convenções & Arquitetura
- Projeto localizado em \`${projectPath}\`.
- Registre aqui decisões de arquitetura, padrões adotados e regras do repositório.
- O agente utiliza este arquivo para manter consistência entre conversas.
`
    await writeFile(memoryPath, defaultMemory, 'utf-8')
  }

  const mcpPath = join(dir, MCP_FILE)
  if (!existsSync(mcpPath)) {
    const defaultMcp = `{
  "$schema": "https://json.schemastore.org/mcp-server-config.json",
  "mcpServers": {
    // Exemplo:
    // "filesystem": {
    //   "command": "npx",
    //   "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    // }
  }
}
`
    await writeFile(mcpPath, defaultMcp, 'utf-8')
  }
}

export async function loadProjectsConfig(): Promise<StoredProjectsConfig> {
  const file = projectsConfigPath()
  try {
    const raw = await readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<StoredProjectsConfig>
    if (parsed && Array.isArray(parsed.projects) && parsed.projects.length > 0) {
      return {
        activeProjectId: parsed.activeProjectId ?? parsed.projects[0].id,
        projects: parsed.projects
      }
    }
  } catch {
    // fallback to default
  }

  // Default project is current working directory
  const defaultPath = process.cwd()
  const defaultId = computeProjectId(defaultPath)
  const defaultProject: ProjectRecord = {
    id: defaultId,
    name: basename(defaultPath) || 'alexandria-ai',
    path: defaultPath,
    lastOpenedAt: Date.now(),
    hasAlexandriaConfig: existsSync(join(defaultPath, ALEXANDRIA_DIR))
  }

  // initialize .alexandria in default project if accessible
  try {
    await ensureAlexandriaDirectory(defaultPath)
    defaultProject.hasAlexandriaConfig = true
  } catch {
    // ignore
  }

  const initialConfig: StoredProjectsConfig = {
    activeProjectId: defaultId,
    projects: [defaultProject]
  }

  await saveProjectsConfig(initialConfig)
  return initialConfig
}

export async function saveProjectsConfig(config: StoredProjectsConfig): Promise<void> {
  const target = projectsConfigPath()
  const tmp = `${target}.${Date.now()}.tmp`
  try {
    await writeFile(tmp, JSON.stringify(config, null, 2), { mode: 0o600 })
    await rename(tmp, target)
  } catch (err) {
    try {
      await unlink(tmp)
    } catch {
      // ignore
    }
    throw err
  }
}

export async function getProjectsState(): Promise<ProjectsState> {
  const config = await loadProjectsConfig()
  const active =
    config.projects.find((p) => p.id === config.activeProjectId) ?? config.projects[0] ?? null
  return {
    activeProjectId: config.activeProjectId,
    activeProject: active,
    projects: config.projects
  }
}

export async function registerProjectFromPath(folderPath: string): Promise<ProjectRecord> {
  const resolved = resolve(folderPath)
  const stats = await stat(resolved)
  if (!stats.isDirectory()) {
    throw new Error(`O caminho ${resolved} não é um diretório válido.`)
  }

  await ensureAlexandriaDirectory(resolved)

  const id = computeProjectId(resolved)
  const name = basename(resolved)
  const config = await loadProjectsConfig()

  const existingIndex = config.projects.findIndex((p) => p.id === id)
  const record: ProjectRecord = {
    id,
    name,
    path: resolved,
    lastOpenedAt: Date.now(),
    hasAlexandriaConfig: true
  }

  if (existingIndex >= 0) {
    config.projects[existingIndex] = record
  } else {
    config.projects.unshift(record)
  }

  config.activeProjectId = id
  await saveProjectsConfig(config)
  return record
}

export async function switchActiveProject(projectId: string): Promise<ProjectRecord | null> {
  const config = await loadProjectsConfig()
  const project = config.projects.find((p) => p.id === projectId)
  if (!project) return null

  project.lastOpenedAt = Date.now()
  config.activeProjectId = project.id
  await saveProjectsConfig(config)
  return project
}

export async function removeProjectFromList(projectId: string): Promise<ProjectsState> {
  const config = await loadProjectsConfig()
  config.projects = config.projects.filter((p) => p.id !== projectId)
  if (config.projects.length === 0) {
    // reset to default cwd
    const defaultPath = process.cwd()
    config.projects = [
      {
        id: computeProjectId(defaultPath),
        name: basename(defaultPath),
        path: defaultPath,
        lastOpenedAt: Date.now(),
        hasAlexandriaConfig: existsSync(join(defaultPath, ALEXANDRIA_DIR))
      }
    ]
  }
  if (!config.projects.some((p) => p.id === config.activeProjectId)) {
    config.activeProjectId = config.projects[0].id
  }
  await saveProjectsConfig(config)
  return getProjectsState()
}

export async function pickProjectDirectory(parentWindow?: BrowserWindow): Promise<string | null> {
  const options = {
    title: 'Selecionar Diretório do Projeto',
    properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
  }
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}

export async function readProjectMemory(projectPath: string): Promise<string> {
  const memPath = join(projectPath, ALEXANDRIA_DIR, MEMORY_FILE)
  try {
    return await readFile(memPath, 'utf-8')
  } catch {
    return ''
  }
}

export async function writeProjectMemory(projectPath: string, content: string): Promise<void> {
  const dir = join(projectPath, ALEXANDRIA_DIR)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
  const memPath = join(dir, MEMORY_FILE)
  await writeFile(memPath, content, 'utf-8')
}
