/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  buildCodeGraph,
  findDependencyPath,
  queryDependencies,
  queryDependents
} from '../src/main/graph/codegraph.ts'

async function runTests() {
  console.log('🧪 Starting Alexandria.AI Standalone Agent & CodeGraph Tests...\n')

  // ── Test 1: CodeGraph Engine ──────────────────────────────────────────────
  console.log('1. Testing CodeGraph Engine...')
  const graph = await buildCodeGraph(process.cwd())

  assert(graph.nodes.length > 5, 'Should discover more than 5 code files')
  assert(graph.edges.length > 5, 'Should discover more than 5 import dependencies')
  assert(graph.stats.totalFiles === graph.nodes.length, 'Stats file count must match nodes')
  assert(Array.isArray(graph.stats.entryPoints), 'Stats should have entrypoints array')

  const mainNode = graph.nodes.find((n) => n.id === 'src/main/index.ts')
  assert(mainNode, 'Should find src/main/index.ts in graph nodes')
  assert.equal(mainNode.type, 'main', 'src/main/index.ts must be classified as main')

  const agentLoop = graph.nodes.find((n) => n.id === 'src/main/agent/loop.ts')
  assert(agentLoop, 'Should find src/main/agent/loop.ts')
  assert.equal(agentLoop.type, 'agent', 'src/main/agent/loop.ts must be classified as agent')

  // Test queryDependencies
  const mainDeps = queryDependencies(graph, 'src/main/index.ts')
  assert(mainDeps.node !== null, 'mainNode query should succeed')
  assert(mainDeps.dependencies.length > 0, 'src/main/index.ts must have local dependencies')

  // Test queryDependents
  const sharedChatDependents = queryDependents(graph, 'src/shared/chat.ts')
  assert(
    sharedChatDependents.dependents.length > 0,
    'src/shared/chat.ts must be imported by multiple modules'
  )

  // Test findDependencyPath
  const path = findDependencyPath(graph, 'src/main/index.ts', 'src/main/agent/loop.ts')
  assert(path !== null, 'Path from src/main/index.ts to src/main/agent/loop.ts must exist')
  assert.equal(path[0], 'src/main/index.ts', 'Path start must be fromId')
  assert.equal(path[path.length - 1], 'src/main/agent/loop.ts', 'Path end must be toId')

  console.log('   ✓ CodeGraph: Scanned', graph.nodes.length, 'files,', graph.edges.length, 'edges.')
  console.log('   ✓ CodeGraph: Dependency queries, dependents, and path tracing work.')

  // ── Test 2: SQLite Sessions & FTS5 ─────────────────────────────────────────
  console.log('\n2. Testing SQLite Sessions & FTS5...')
  const testDbFile = join(tmpdir(), `alexandria-test-sessions-${Date.now()}.db`)
  const db = new DatabaseSync(testDbFile)

  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
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
    `)

    // Insert test session
    const sessionId = 'test-sess-1'
    const now = new Date().toISOString()
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?)').run(
      sessionId,
      'Conversa sobre CodeGraph',
      now,
      now
    )
    db.prepare(
      'INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(sessionId, 'user', 'Como funciona a análise estática no Alexandria?', now)
    db.prepare(
      'INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)'
    ).run(
      sessionId,
      'assistant',
      'O Alexandria utiliza o motor CodeGraph para extrair nós e arestas de importação.',
      now
    )

    // Test listSessions
    const list = db.prepare('SELECT id, title FROM sessions ORDER BY updated_at DESC').all()
    assert.equal(list.length, 1)
    assert.equal(list[0].title, 'Conversa sobre CodeGraph')

    // Test getSessionMessages
    const messages = db
      .prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC')
      .all(sessionId)
    assert.equal(messages.length, 2)
    assert.equal(messages[0].role, 'user')
    assert.equal(messages[1].role, 'assistant')

    // Test FTS5 search
    const ftsResults = db
      .prepare(
        `SELECT m.session_id, m.content
         FROM messages_fts f
         JOIN messages m ON m.id = f.rowid
         WHERE messages_fts MATCH '"CodeGraph"'`
      )
      .all()
    assert.equal(ftsResults.length, 1, 'FTS5 search should find 1 match for "CodeGraph"')
    assert(ftsResults[0].content.includes('motor CodeGraph'))

    // Test cascade delete
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
    const remainingMessages = db
      .prepare('SELECT id FROM messages WHERE session_id = ?')
      .all(sessionId)
    assert.equal(remainingMessages.length, 0, 'Messages must be deleted via CASCADE')

    console.log('   ✓ SQLite: CRUD, cascade deletion, and FTS5 full-text indexing work.')
  } finally {
    db.close()
    try {
      rmSync(testDbFile, { force: true })
      rmSync(`${testDbFile}-wal`, { force: true })
      rmSync(`${testDbFile}-shm`, { force: true })
    } catch {
      // ignore cleanup
    }
  }

  // ── Test 3: Providers Catalog & Validation ─────────────────────────────────
  console.log('\n3. Testing Provider Definitions & Model Catalogs...')
  const { PROVIDERS, PROVIDER_IDS } = await import('../src/shared/providers.ts')

  assert(PROVIDER_IDS.includes('deepseek'), 'DeepSeek must be registered')
  assert(PROVIDER_IDS.includes('openrouter'), 'OpenRouter must be registered')

  assert.equal(PROVIDERS.deepseek.baseUrl, 'https://api.deepseek.com/v1')
  assert.equal(PROVIDERS.openrouter.baseUrl, 'https://openrouter.ai/api/v1')
  assert(PROVIDERS.openrouter.defaultModel.endsWith(':free'), 'OpenRouter default should be free')
  assert(
    PROVIDERS.openrouter.models.some((m) => m.isFree),
    'OpenRouter must offer free models'
  )
  assert(PROVIDERS.openrouter.extraHeaders['HTTP-Referer'])
  assert(PROVIDERS.openrouter.extraHeaders['X-Title'])
  console.log('   ✓ Providers: DeepSeek and OpenRouter definitions aligned.')

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!\n')
}

runTests().catch((err) => {
  console.error('\n❌ Test failure:', err)
  process.exit(1)
})
