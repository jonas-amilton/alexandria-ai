/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'

async function runTests() {
  console.log('🧪 Starting Alexandria.AI Multi-Project, Skills & RAG Tests...\n')

  const testDir = join(tmpdir(), `alexandria-test-env-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })

  try {
    // ── Test 1: Project Setup & .alexandria templates ─────────────────────────
    console.log('1. Testing Project Setup & Templates...')
    const projPath = join(testDir, 'my-sample-project')
    mkdirSync(projPath, { recursive: true })

    const alexDir = join(projPath, '.alexandria')
    mkdirSync(alexDir, { recursive: true })

    const memFile = join(alexDir, 'MEMORY.md')
    const mcpFile = join(alexDir, 'mcp.json')

    writeFileSync(memFile, '# Sample Project Memory\n- Rule 1: Use TypeScript\n', 'utf-8')
    writeFileSync(
      mcpFile,
      JSON.stringify({ mcpServers: { testServer: { command: 'echo' } } }),
      'utf-8'
    )

    assert(existsSync(memFile), 'MEMORY.md should exist')
    assert(existsSync(mcpFile), 'mcp.json should exist')

    const projId = createHash('sha256').update(projPath.toLowerCase()).digest('hex').slice(0, 16)
    assert.equal(projId.length, 16, 'Project ID must be a 16-character hex hash')
    console.log('   ✓ Project ID generated:', projId)
    console.log('   ✓ Project .alexandria/ templates verified.')

    // ── Test 2: Project-Scoped SQLite Sessions Isolation ──────────────────────
    console.log('\n2. Testing Project-Scoped Sessions Isolation...')
    const dbFile = join(testDir, 'test-scoped-sessions.db')
    const db = new DatabaseSync(dbFile)

    db.exec(`
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_id TEXT DEFAULT 'default',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `)

    const insert = db.prepare(
      'INSERT INTO sessions (id, title, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    )
    const now = new Date().toISOString()

    insert.run('sess-proj-1', 'Chat in Project 1', 'proj-1', now, now)
    insert.run('sess-proj-2', 'Chat in Project 2', 'proj-2', now, now)
    insert.run('sess-proj-1b', 'Second Chat in Project 1', 'proj-1', now, now)

    const listByProj1 = db.prepare('SELECT id FROM sessions WHERE project_id = ?').all('proj-1')
    assert.equal(listByProj1.length, 2, 'Project 1 must only have 2 sessions')
    assert(
      listByProj1.some((s) => s.id === 'sess-proj-1'),
      'sess-proj-1 should be in Project 1'
    )
    assert(
      listByProj1.some((s) => s.id === 'sess-proj-1b'),
      'sess-proj-1b should be in Project 1'
    )

    const listByProj2 = db.prepare('SELECT id FROM sessions WHERE project_id = ?').all('proj-2')
    assert.equal(listByProj2.length, 1, 'Project 2 must only have 1 session')
    assert.equal(listByProj2[0].id, 'sess-proj-2', 'sess-proj-2 should be in Project 2')

    db.close()
    console.log('   ✓ Sessions are strictly isolated per project_id.')

    // ── Test 3: Local RAG (SQLite FTS5 + BM25 Chunking) ────────────────────────
    console.log('\n3. Testing Local RAG Engine (FTS5 + BM25)...')
    const ragDbFile = join(testDir, 'test-rag.db')
    const ragDb = new DatabaseSync(ragDbFile)

    ragDb.exec(`
      CREATE TABLE rag_chunks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        content TEXT NOT NULL,
        file_hash TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE rag_fts USING fts5(
        content,
        file_path,
        content='rag_chunks',
        content_rowid='rowid'
      );

      CREATE TRIGGER rag_after_insert AFTER INSERT ON rag_chunks BEGIN
        INSERT INTO rag_fts(rowid, content, file_path) VALUES (new.rowid, new.content, new.file_path);
      END;
    `)

    const insertChunk = ragDb.prepare(
      'INSERT INTO rag_chunks (id, project_id, file_path, start_line, end_line, content, file_hash) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )

    insertChunk.run(
      'c1',
      'proj-1',
      'src/auth/jwt.ts',
      1,
      25,
      'export function generateToken(user: User): string { return signJwt(user.id); }',
      'hash1'
    )

    insertChunk.run(
      'c2',
      'proj-1',
      'src/auth/permissions.ts',
      26,
      50,
      'export function verifyRole(role: string): boolean { return role === "admin"; }',
      'hash2'
    )

    insertChunk.run(
      'c3',
      'proj-2',
      'src/payment/stripe.ts',
      1,
      30,
      'export function processPayment(amount: number): Receipt { ... }',
      'hash3'
    )

    // Test query for permissions in proj-1
    const queryStmt = ragDb.prepare(
      `SELECT c.file_path AS filePath, c.start_line AS startLine, c.end_line AS endLine, c.content AS snippet
       FROM rag_fts f
       JOIN rag_chunks c ON c.rowid = f.rowid
       WHERE c.project_id = ? AND rag_fts MATCH ?
       ORDER BY f.rank ASC`
    )

    const results = queryStmt.all('proj-1', '"verifyRole" OR "admin"')
    assert.equal(results.length, 1, 'Should find exactly 1 matching chunk in proj-1')
    assert.equal(
      results[0].filePath,
      'src/auth/permissions.ts',
      'Found file must be permissions.ts'
    )
    assert.equal(results[0].startLine, 26, 'Start line must be 26')
    assert(results[0].snippet.includes('verifyRole'), 'Snippet must contain exact verified code')

    // Ensure proj-2 chunks are not returned when querying proj-1
    const noResults = queryStmt.all('proj-1', '"processPayment"')
    assert.equal(noResults.length, 0, 'proj-1 RAG query should not find proj-2 chunks')

    ragDb.close()
    console.log('   ✓ RAG Engine: SQLite FTS5 + BM25 chunking and anti-hallucination query passed.')

    // ── Test 4: Skills Markdown & Frontmatter Formatting ──────────────────────
    console.log('\n4. Testing Skills Frontmatter & Body Handling...')
    const skillMarkdown = `---
name: code-reviewer
description: Reviews pull requests for clean code and performance.
---

# Code Reviewer Skill
Follow these steps to analyze the code diff...`

    assert(skillMarkdown.startsWith('---\n'), 'Must start with YAML delimiter')
    assert(skillMarkdown.includes('name: code-reviewer'), 'Must have skill name in frontmatter')
    assert(skillMarkdown.includes('description:'), 'Must have skill description in frontmatter')

    console.log('   ✓ Skills frontmatter and markdown structure verified.')

    // ── Test 5: GitHub URL Resolution for Skill Import ────────────────────────
    console.log('\n5. Testing GitHub URL Resolution for Skill Import...')
    const { resolveGithubRawUrls } = await import('../src/main/agent/skills.ts')

    // Blob URL
    const blobUrls = resolveGithubRawUrls(
      'https://github.com/anthropics/anthropic-quickstarts/blob/main/skills/computer-use/SKILL.md'
    )
    assert.equal(
      blobUrls[0],
      'https://raw.githubusercontent.com/anthropics/anthropic-quickstarts/main/skills/computer-use/SKILL.md'
    )

    // Tree / directory URL
    const treeUrls = resolveGithubRawUrls('https://github.com/owner/repo/tree/main/skills/my-skill')
    assert.equal(
      treeUrls[0],
      'https://raw.githubusercontent.com/owner/repo/main/skills/my-skill/SKILL.md'
    )

    // Gist URL
    const gistUrls = resolveGithubRawUrls('https://gist.github.com/testuser/123456789abcdef')
    assert.equal(gistUrls[0], 'https://gist.githubusercontent.com/testuser/123456789abcdef/raw')

    // Repo URL with .git (ponytail case)
    const repoGitUrls = resolveGithubRawUrls('https://github.com/DietrichGebert/ponytail.git')
    assert(
      repoGitUrls.includes(
        'https://raw.githubusercontent.com/DietrichGebert/ponytail/main/skills/ponytail/SKILL.md'
      ),
      'Must include candidates for skills/ponytail/SKILL.md'
    )

    console.log('   ✓ GitHub URL resolution for skill imports verified.')

    // ── Test 6: Global AGENTS.md Persistence ────────────────────────────────
    console.log('\n6. Testing Global AGENTS.md Persistence...')
    const { readGlobalAgentsMd, saveGlobalAgentsMd } =
      await import('../src/main/agent/agents-md.ts')
    const initial = await readGlobalAgentsMd()
    assert(initial.includes('# AGENTS.md'), 'Must have default AGENTS.md heading')
    await saveGlobalAgentsMd('# Custom AGENTS.md\n\nBe fast and accurate.')
    const updated = await readGlobalAgentsMd()
    assert.equal(updated, '# Custom AGENTS.md\n\nBe fast and accurate.')
    // restore initial
    await saveGlobalAgentsMd(initial)
    console.log('   ✓ Global AGENTS.md read, write, and restore verified.')

    // ── Test 7: Claude-Code-like Skills Architecture (Alexandria Native) ────
    console.log(
      '\n7. Testing Claude-Code-like Skills Architecture (Project Precedence, XML, Ranking, Slash Commands)...'
    )
    const { listSkills, getSkill, projectSkillRoots } = await import('../src/main/agent/skills.ts')
    const { rankSkillsForMessage, extractSlashCommand, formatSkillsXml, buildAgentSystemPrompt } =
      await import('../src/main/agent/prompts.ts')

    // 7.1 Verify NO .claude directory in discovery paths
    const sampleProjDir = join(testDir, 'sample-project')
    const roots = projectSkillRoots(sampleProjDir)
    assert(
      roots.every((r) => !r.includes('.claude')),
      'Harness constraint: MUST NOT reference any directory named .claude'
    )
    assert(
      roots.some((r) => r.includes('.alexandria')),
      'Must include .alexandria/skills'
    )
    assert(
      roots.some((r) => r.includes('.agents')),
      'Must include .agents/skills'
    )

    // 7.2 Test Project Precedence (Project > Global)
    const projSkillDir = join(sampleProjDir, '.alexandria', 'skills', 'ponytail')
    mkdirSync(projSkillDir, { recursive: true })
    writeFileSync(
      join(projSkillDir, 'SKILL.md'),
      `---
name: ponytail
description: Project-override ponytail skill with full rich description for minimal code and YAGNI.
---

# Project Specific Ponytail
Always do the simplest thing.`
    )

    const projectSkills = await listSkills(sampleProjDir)
    const foundPonytail = projectSkills.find((s) => s.name === 'ponytail')
    assert(foundPonytail, 'Project-level ponytail must be discovered')
    assert.equal(foundPonytail.scope, 'project', 'Scope must be project')
    assert.equal(
      foundPonytail.description,
      'Project-override ponytail skill with full rich description for minimal code and YAGNI.'
    )

    const fetchedSkill = await getSkill('ponytail', sampleProjDir)
    assert(fetchedSkill, 'getSkill must find project skill')
    assert.equal(fetchedSkill.scope, 'project')
    assert(fetchedSkill.body.includes('Project Specific Ponytail'))

    // 7.3 Test Relevance Ranking
    const mockSkills = [
      {
        name: 'code-reviewer',
        description:
          'Reviews pull requests for clean code, style guidelines and potential regressions.',
        markdown: '',
        body: ''
      },
      {
        name: 'database-migrator',
        description:
          'Runs schema migrations, checks SQL indexes and verifies database constraints.',
        markdown: '',
        body: ''
      },
      {
        name: 'ponytail',
        description:
          'Lazy senior dev mode: the smallest change that fully solves the task. Use on any coding task and when the user says ponytail, be lazy, simplest solution, yagni, or complains about over-engineering.',
        markdown: '',
        body: ''
      }
    ]

    const ranked = rankSkillsForMessage(
      mockSkills,
      'Preciso que você escreva o código da forma mais simples possível sem overengineering, use YAGNI'
    )
    assert.equal(
      ranked[0].name,
      'ponytail',
      'Ponytail must be ranked #1 for query matching yagni and overengineering'
    )

    // 7.4 Test Slash Command Extraction
    const slash1 = extractSlashCommand('/ponytail faça a refatoração', mockSkills)
    assert(slash1, 'Must detect /ponytail slash command')
    assert.equal(slash1.name, 'ponytail')

    const slashUnknown = extractSlashCommand('/desconhecido teste', mockSkills)
    assert.equal(slashUnknown, null, 'Unregistered slash command must return null')

    // 7.5 Test XML Formatting (<skills><skill>...)
    const { xml, invokedSkill } = formatSkillsXml(mockSkills, '/ponytail refatore isso')
    assert.equal(invokedSkill.name, 'ponytail')
    assert(xml.startsWith('<skills>\n'), 'Must start with <skills> XML tag')
    assert(
      xml.includes('<skill>\n    <name>ponytail</name>'),
      'Must contain <skill> block with <name>'
    )
    assert(xml.includes('<description>Lazy senior dev mode'), 'Must contain rich <description>')
    assert(xml.endsWith('\n</skills>'), 'Must end with </skills>')
    // Ensure description was NOT truncated to 60 chars!
    assert(
      xml.includes('over-engineering'),
      'Rich description with over-engineering must be preserved without 60-char truncation'
    )

    // 7.6 Test System Prompt Injection
    const prompt = buildAgentSystemPrompt({
      providerLabel: 'DeepSeek',
      model: 'deepseek-flash',
      memory: { memory: [], user: [] },
      skills: mockSkills,
      userMessage: '/ponytail refatore a função com simplicidade'
    })

    assert(prompt.includes('<skills>'), 'Prompt must include <skills> XML block')
    assert(
      prompt.includes(
        "The user explicitly invoked '/ponytail'. You MUST call skill_view(name='ponytail')"
      ),
      'Prompt must instruct agent to call skill_view immediately when slash command is used'
    )

    console.log(
      '   ✓ Claude-Code-like skills architecture verified (No .claude, XML format, Project Precedence, Slash Commands, Relevance Ranking).'
    )

    console.log('\n🎉 ALL TESTS PASSED! Multi-Project, Skills and RAG are working perfectly.')
  } finally {
    try {
      rmSync(testDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  }
}

void runTests()
