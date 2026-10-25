import { createHash } from 'crypto'
import { readdir, readFile, stat } from 'fs/promises'
import { extname, join, relative, resolve } from 'path'

import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'

import type { RagIndexStats, RagSearchResult } from '../../shared/rag'

let dbInstance: DatabaseSync | null = null

function getRagDatabase(): DatabaseSync {
  if (dbInstance !== null) {
    return dbInstance
  }

  const file = join(app.getPath('userData'), 'agent-rag.db')
  dbInstance = new DatabaseSync(file)

  dbInstance.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS rag_chunks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      file_path TEXT NOT NULL,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      content TEXT NOT NULL,
      file_hash TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS rag_chunks_proj_idx ON rag_chunks(project_id);
    CREATE INDEX IF NOT EXISTS rag_chunks_file_idx ON rag_chunks(project_id, file_path);

    CREATE VIRTUAL TABLE IF NOT EXISTS rag_fts USING fts5(
      content,
      file_path,
      content='rag_chunks',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS rag_after_insert AFTER INSERT ON rag_chunks BEGIN
      INSERT INTO rag_fts(rowid, content, file_path) VALUES (new.rowid, new.content, new.file_path);
    END;

    CREATE TRIGGER IF NOT EXISTS rag_after_delete AFTER DELETE ON rag_chunks BEGIN
      INSERT INTO rag_fts(rag_fts, rowid, content, file_path) VALUES ('delete', old.rowid, old.content, old.file_path);
    END;

    CREATE TRIGGER IF NOT EXISTS rag_after_update AFTER UPDATE ON rag_chunks BEGIN
      INSERT INTO rag_fts(rag_fts, rowid, content, file_path) VALUES ('delete', old.rowid, old.content, old.file_path);
      INSERT INTO rag_fts(rowid, content, file_path) VALUES (new.rowid, new.content, new.file_path);
    END;
  `)

  return dbInstance
}

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.alexandria',
  'dist',
  'out',
  'build',
  '.next',
  '.cache',
  'coverage',
  '.archive'
])

const INDEXABLE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.c',
  '.cpp',
  '.h',
  '.html',
  '.css',
  '.sql',
  '.yaml',
  '.yml'
])

const MAX_FILE_SIZE = 500 * 1024 // 500KB
const CHUNK_SIZE_LINES = 60
const CHUNK_OVERLAP_LINES = 10

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

function chunkFile(
  relPath: string,
  content: string,
  projectId: string,
  fileHash: string
): Array<{
  id: string
  projectId: string
  filePath: string
  startLine: number
  endLine: number
  content: string
  fileHash: string
}> {
  const lines = content.split('\n')
  if (lines.length === 0) return []

  const chunks: Array<{
    id: string
    projectId: string
    filePath: string
    startLine: number
    endLine: number
    content: string
    fileHash: string
  }> = []

  let start = 0
  while (start < lines.length) {
    const end = Math.min(start + CHUNK_SIZE_LINES, lines.length)
    const chunkText = lines.slice(start, end).join('\n')
    const chunkId = `${projectId}:${relPath}:${start + 1}-${end}`

    chunks.push({
      id: chunkId,
      projectId,
      filePath: relPath,
      startLine: start + 1,
      endLine: end,
      content: chunkText,
      fileHash
    })

    if (end >= lines.length) break
    start += CHUNK_SIZE_LINES - CHUNK_OVERLAP_LINES
  }

  return chunks
}

async function collectFiles(dir: string, baseDir: string, list: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
        await collectFiles(join(dir, entry.name), baseDir, list)
      }
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase()
      if (INDEXABLE_EXTENSIONS.has(ext)) {
        list.push(join(dir, entry.name))
      }
    }
  }
}

export async function indexProject(projectId: string, projectRoot: string): Promise<RagIndexStats> {
  const root = resolve(projectRoot)
  const allFiles: string[] = []
  await collectFiles(root, root, allFiles)

  const db = getRagDatabase()

  // Get current file hashes stored for this project
  const storedRows = db
    .prepare('SELECT DISTINCT file_path, file_hash FROM rag_chunks WHERE project_id = ?')
    .all(projectId) as unknown as Array<{ file_path: string; file_hash: string }>

  const storedMap = new Map<string, string>()
  for (const row of storedRows) {
    storedMap.set(row.file_path, row.file_hash)
  }

  const activeFilesSet = new Set<string>()

  for (const absPath of allFiles) {
    const relPath = relative(root, absPath)
    activeFilesSet.add(relPath)

    try {
      const fileStats = await stat(absPath)
      if (fileStats.size > MAX_FILE_SIZE) continue

      const raw = await readFile(absPath, 'utf-8')
      const currentHash = hashContent(raw)

      if (storedMap.get(relPath) === currentHash) {
        // unchanged, keep
        continue
      }

      // Changed or new: remove existing chunks for this file
      db.prepare('DELETE FROM rag_chunks WHERE project_id = ? AND file_path = ?').run(
        projectId,
        relPath
      )

      const chunks = chunkFile(relPath, raw, projectId, currentHash)
      const insert = db.prepare(
        'INSERT INTO rag_chunks (id, project_id, file_path, start_line, end_line, content, file_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )

      for (const ch of chunks) {
        insert.run(
          ch.id,
          ch.projectId,
          ch.filePath,
          ch.startLine,
          ch.endLine,
          ch.content,
          ch.fileHash
        )
      }
    } catch {
      // ignore individual read errors
    }
  }

  // Clean up files that were deleted from disk
  for (const [storedPath] of storedMap) {
    if (!activeFilesSet.has(storedPath)) {
      db.prepare('DELETE FROM rag_chunks WHERE project_id = ? AND file_path = ?').run(
        projectId,
        storedPath
      )
    }
  }

  return getRagStats(projectId)
}

function toFtsQuery(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map((token) => token.replace(/["*()^:]/g, '').trim())
    .filter((token) => token.length > 0)

  if (tokens.length === 0) return ''
  return tokens.map((token) => `"${token}"`).join(' OR ')
}

export function searchRag(projectId: string, query: string, limit = 5): RagSearchResult[] {
  const ftsMatch = toFtsQuery(query)
  if (!ftsMatch) return []

  const db = getRagDatabase()
  try {
    const rows = db
      .prepare(
        `SELECT c.file_path AS filePath,
                c.start_line AS startLine,
                c.end_line AS endLine,
                c.content AS snippet,
                f.rank AS score
         FROM rag_fts f
         JOIN rag_chunks c ON c.rowid = f.rowid
         WHERE c.project_id = ? AND rag_fts MATCH ?
         ORDER BY f.rank ASC
         LIMIT ?`
      )
      .all(projectId, ftsMatch, limit) as unknown as Array<{
      filePath: string
      startLine: number
      endLine: number
      snippet: string
      score?: number
    }>

    return rows.map((r) => ({
      filePath: r.filePath,
      startLine: r.startLine,
      endLine: r.endLine,
      snippet: r.snippet,
      score: r.score
    }))
  } catch {
    return []
  }
}

export function getRagStats(projectId: string): RagIndexStats {
  const db = getRagDatabase()
  try {
    const countRow = db
      .prepare(
        `SELECT COUNT(DISTINCT file_path) AS fileCount, COUNT(*) AS chunkCount
         FROM rag_chunks
         WHERE project_id = ?`
      )
      .get(projectId) as unknown as { fileCount?: number; chunkCount?: number } | undefined

    return {
      indexedFiles: countRow?.fileCount ?? 0,
      totalChunks: countRow?.chunkCount ?? 0,
      lastIndexedAt: Date.now()
    }
  } catch {
    return { indexedFiles: 0, totalChunks: 0 }
  }
}
