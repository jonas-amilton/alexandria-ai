import { randomUUID } from 'crypto'
import { join } from 'path'

import { app } from 'electron'
import { DatabaseSync } from 'node:sqlite'

// Hermes keeps transcripts in SQLite (state.db, WAL) and indexes them with
// FTS5; built-in memory lives in Markdown files instead. This module replicates
// the transcript/search slice: one row per user/assistant message, an FTS5
// index, and keyword search over past conversations.

export interface SessionSearchResult {
  sessionId: string
  title: string
  role: string
  content: string
  createdAt: string
}

export interface SessionItem {
  id: string
  title: string
  projectId?: string
  createdAt: string
  updatedAt: string
}

let database: DatabaseSync | null = null

function getDatabase(): DatabaseSync {
  if (database !== null) {
    return database
  }

  const file = join(app.getPath('userData'), 'agent-sessions.db')

  database = new DatabaseSync(file)

  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      project_id TEXT DEFAULT 'default',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      content='messages',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS messages_after_insert AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_after_delete AFTER DELETE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_after_update AFTER UPDATE ON messages BEGIN
      INSERT INTO messages_fts(messages_fts, rowid, content) VALUES ('delete', old.id, old.content);
      INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
    END;
  `)

  try {
    database.exec(`ALTER TABLE sessions ADD COLUMN project_id TEXT DEFAULT 'default';`)
  } catch {
    // Column already exists
  }

  return database
}

function nowIso(): string {
  return new Date().toISOString()
}

function toFtsQuery(query: string): string {
  const tokens = query
    .split(/\s+/)
    .map((token) => token.replace(/["*()]/g, '').trim())
    .filter((token) => token.length > 0)

  return tokens.map((token) => `"${token}"`).join(' ')
}

export function ensureSession(sessionId: string, title: string, projectId = 'default'): void {
  const timestamp = nowIso()
  const cleanTitle = title.replace(/\s+/g, ' ').trim().slice(0, 120) || 'Nova conversa'

  getDatabase()
    .prepare(
      `INSERT INTO sessions (id, title, project_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at`
    )
    .run(sessionId, cleanTitle, projectId, timestamp, timestamp)
}

export function recordMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string
): void {
  const trimmed = content.trim()

  if (trimmed.length === 0) {
    return
  }

  getDatabase()
    .prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)')
    .run(sessionId, role, trimmed, nowIso())

  getDatabase().prepare('UPDATE sessions SET updated_at = ? WHERE id = ?').run(nowIso(), sessionId)
}

export function recordExchange(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  projectId = 'default'
): void {
  ensureSession(sessionId, userMessage, projectId)
  recordMessage(sessionId, 'user', userMessage)
  recordMessage(sessionId, 'assistant', assistantMessage)
}

export function searchSessions(query: string, limit = 5): SessionSearchResult[] {
  const match = toFtsQuery(query)

  if (!match) {
    return []
  }

  try {
    return getDatabase()
      .prepare(
        `SELECT m.session_id AS sessionId,
                s.title AS title,
                m.role AS role,
                m.content AS content,
                m.created_at AS createdAt
         FROM messages_fts f
         JOIN messages m ON m.id = f.rowid
         JOIN sessions s ON s.id = m.session_id
         WHERE messages_fts MATCH ?
         ORDER BY rank
         LIMIT ?`
      )
      .all(match, limit) as unknown as SessionSearchResult[]
  } catch {
    return []
  }
}

export function listSessions(projectId?: string, limit = 50): SessionItem[] {
  try {
    if (projectId) {
      return getDatabase()
        .prepare(
          `SELECT id, title, project_id AS projectId, created_at AS createdAt, updated_at AS updatedAt
           FROM sessions
           WHERE project_id = ?
           ORDER BY updated_at DESC
           LIMIT ?`
        )
        .all(projectId, limit) as unknown as SessionItem[]
    }

    return getDatabase()
      .prepare(
        `SELECT id, title, project_id AS projectId, created_at AS createdAt, updated_at AS updatedAt
         FROM sessions
         ORDER BY updated_at DESC
         LIMIT ?`
      )
      .all(limit) as unknown as SessionItem[]
  } catch {
    return []
  }
}

export function getSessionMessages(
  sessionId: string
): Array<{ role: 'user' | 'assistant'; content: string; createdAt: string }> {
  try {
    return getDatabase()
      .prepare(
        `SELECT role, content, created_at AS createdAt
         FROM messages
         WHERE session_id = ?
         ORDER BY id ASC`
      )
      .all(sessionId) as unknown as Array<{
      role: 'user' | 'assistant'
      content: string
      createdAt: string
    }>
  } catch {
    return []
  }
}

export function deleteSession(sessionId: string): void {
  try {
    getDatabase().prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  } catch {
    // ignore
  }
}

export function newSessionId(): string {
  return `sess-${randomUUID()}`
}

export function closeSessionStore(): void {
  if (database !== null) {
    database.close()
    database = null
  }
}
