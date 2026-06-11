import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import Database from 'better-sqlite3'
import {
  adminToken,
  createSubmission,
  requestJson,
  startServer,
  validSubmission,
} from './test-helpers.mjs'

async function approveSubmission(server, admin, submissionId, body = { mode: 'plainAuthor' }) {
  const result = await requestJson(server.baseUrl, `/api/admin/submissions/${submissionId}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify(body),
  })
  assert.equal(result.res.status, 200)
  return result.body
}

test('public read APIs support boards, filters, details, authors, and persistent like limits', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'planshare-like-limit-'))
  const databasePath = join(root, 'planshare.db')
  const first = await startServer({ DATABASE_PATH: databasePath })

  const boards = await requestJson(first.baseUrl, '/api/boards')
  assert.equal(boards.res.status, 200)
  assert.ok(boards.body.length > 0)
  const board = boards.body[0]

  const filtered = await requestJson(first.baseUrl, `/api/boards?raidId=${board.raidId}&bossId=${board.bossId}`)
  assert.equal(filtered.res.status, 200)
  assert.equal(filtered.body.every((item) => item.raidId === board.raidId && item.bossId === board.bossId), true)

  const detail = await requestJson(first.baseUrl, `/api/boards/${board.id}`)
  assert.equal(detail.res.status, 200)
  assert.equal(detail.body.board.id, board.id)
  assert.equal(detail.body.author.id, board.authorId)

  const author = await requestJson(first.baseUrl, `/api/authors/${board.authorId}`)
  assert.equal(author.res.status, 200)
  assert.equal(author.body.boards.every((item) => item.authorId === board.authorId), true)

  const headers = { 'X-Real-IP': '198.51.100.10' }
  for (let i = 0; i < 5; i += 1) {
    const like = await requestJson(first.baseUrl, `/api/boards/${board.id}/like`, {
      method: 'POST',
      headers,
    })
    assert.equal(like.res.status, 200)
  }
  await first.stop()

  const second = await startServer({ DATABASE_PATH: databasePath })
  t.after(() => second.stop())
  const blocked = await requestJson(second.baseUrl, `/api/boards/${board.id}/like`, {
    method: 'POST',
    headers,
  })
  assert.equal(blocked.res.status, 429)
})

test('new creator needs three approved submissions, rejection resets review progress, and legacy DBs migrate as trusted', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const admin = await adminToken(server.baseUrl)

  const first = await createSubmission(server, {
    wantsCreatorProfile: true,
    creatorUsername: 'trust_path',
    creatorPassword: 'creator-password-123',
  })
  const authorId = first.creatorAuth.author.id
  const token = first.creatorAuth.token
  const firstApproval = await approveSubmission(server, admin, first.id, { mode: 'createAuthor' })
  assert.equal(firstApproval.creatorAccount.trustLevel, 'review')
  assert.equal(firstApproval.creatorAccount.approvedSubmissionCount, 1)

  const earlyDirect = await requestJson(server.baseUrl, '/api/creator/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(validSubmission({ title: '未达三次直发', submitterName: 'UGC 作者' })),
  })
  assert.equal(earlyDirect.res.status, 403)

  const second = await createSubmission(server, {
    title: '第二次审核',
    contentText: '第二次审核正文',
    submitterName: 'UGC 作者',
    wantsCreatorProfile: false,
  }, { headers: { Authorization: `Bearer ${token}` } })
  const secondApproval = await approveSubmission(server, admin, second.id, { mode: 'existingAuthor', authorId })
  assert.equal(secondApproval.creatorAccount.approvedSubmissionCount, 2)

  const resetTarget = await createSubmission(server, {
    title: '重置审核进度',
    contentText: '重置审核进度正文',
    submitterName: 'UGC 作者',
    wantsCreatorProfile: false,
  }, { headers: { Authorization: `Bearer ${token}` } })
  const rejected = await requestJson(server.baseUrl, `/api/admin/submissions/${resetTarget.id}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ note: '测试重置' }),
  })
  assert.equal(rejected.res.status, 200)

  const afterResetAccounts = await requestJson(server.baseUrl, '/api/admin/creator-accounts', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  const resetAccount = afterResetAccounts.body.find((item) => item.username === 'trust_path')
  assert.equal(resetAccount.approvedSubmissionCount, 0)
  assert.equal(resetAccount.trustLevel, 'review')

  for (const suffix of ['a', 'b', 'c']) {
    const submission = await createSubmission(server, {
      title: `晋升审核 ${suffix}`,
      contentText: `晋升审核正文 ${suffix}`,
      submitterName: 'UGC 作者',
      wantsCreatorProfile: false,
    }, { headers: { Authorization: `Bearer ${token}` } })
    await approveSubmission(server, admin, submission.id, { mode: 'existingAuthor', authorId })
  }

  const direct = await requestJson(server.baseUrl, '/api/creator/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(validSubmission({
      title: '三次通过后直发',
      description: '已达到 trusted',
      contentText: 'P1 三次通过后直发',
    })),
  })
  assert.equal(direct.res.status, 201)

  const root = mkdtempSync(join(tmpdir(), 'planshare-legacy-'))
  const legacyPath = join(root, 'planshare.db')
  const db = new Database(legacyPath)
  db.exec(`
    CREATE TABLE creator_accounts (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      username TEXT UNIQUE,
      email_verified_at TEXT,
      password_hash TEXT,
      status TEXT NOT NULL,
      author_id TEXT,
      contact TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT
    );
  `)
  db.close()
  const migrated = await startServer({ DATABASE_PATH: legacyPath })
  await migrated.stop()
  const migratedDb = new Database(legacyPath)
  const columns = migratedDb.prepare('PRAGMA table_info(creator_accounts)').all().map((item) => item.name)
  assert.equal(columns.includes('trust_level'), true)
  assert.equal(columns.includes('approved_submission_count'), true)
  migratedDb.close()
})

test('abuse protections mark honeypot, normalized blacklist, and duplicate same-IP submissions as spam', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const headers = { 'X-Real-IP': '203.0.113.55' }

  const honeypot = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    headers,
    body: JSON.stringify(validSubmission({ title: '蜜罐投稿', website: 'https://bot.example' })),
  })
  assert.equal(honeypot.res.status, 201)
  assert.equal(honeypot.body.status, 'spam')
  assert.equal(honeypot.body.spamReason, 'honeypot')

  const blacklist = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    headers,
    body: JSON.stringify(validSubmission({
      title: '归一化筛查',
      contentText: '这是一条博 彩广告',
    })),
  })
  assert.equal(blacklist.res.status, 201)
  assert.equal(blacklist.body.status, 'spam')
  assert.equal(blacklist.body.spamReason, 'content_blacklist')

  const first = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    headers,
    body: JSON.stringify(validSubmission({ title: '重复正文 1', contentText: '完全相同正文' })),
  })
  assert.equal(first.res.status, 201)
  assert.equal(first.body.status, 'pending')

  const duplicate = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    headers,
    body: JSON.stringify(validSubmission({ title: '重复正文 2', contentText: '完全相同正文' })),
  })
  assert.equal(duplicate.res.status, 201)
  assert.equal(duplicate.body.status, 'spam')
  assert.equal(duplicate.body.spamReason, 'duplicate_content')
})

test('reports flow through admin queue, can hide boards, and admin actions are audited', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const boards = await requestJson(server.baseUrl, '/api/boards')
  const board = boards.body[0]

  const report = await requestJson(server.baseUrl, `/api/boards/${board.id}/reports`, {
    method: 'POST',
    headers: { 'X-Real-IP': '198.51.100.77' },
    body: JSON.stringify({ reason: 'wrong-info', detail: '时间轴不匹配' }),
  })
  assert.equal(report.res.status, 201)
  assert.equal(report.body.status, 'pending')
  assert.equal(report.body.boardTitle, board.title)
  assert.equal(report.body.boardContent, board.contentText)

  const admin = await adminToken(server.baseUrl)
  const reports = await requestJson(server.baseUrl, '/api/admin/reports', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(reports.res.status, 200)
  assert.equal(reports.body.some((item) => item.id === report.body.id), true)
  const queuedReport = reports.body.find((item) => item.id === report.body.id)
  assert.equal(queuedReport.boardTitle, board.title)
  assert.equal(queuedReport.boardContent, board.contentText)

  const hidden = await requestJson(server.baseUrl, `/api/admin/reports/${report.body.id}/hide-board`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ note: '确认隐藏' }),
  })
  assert.equal(hidden.res.status, 200)
  assert.equal(hidden.body.status, 'hidden')

  const publicBoard = await requestJson(server.baseUrl, `/api/boards/${board.id}`)
  assert.equal(publicBoard.res.status, 404)

  const audit = await requestJson(server.baseUrl, '/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(audit.res.status, 200)
  assert.equal(audit.body.some((item) => item.action === 'report_hide_board'), true)
})

test('admin can manage raids and bosses and deletion checks block linked content', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const admin = await adminToken(server.baseUrl)

  const raid = await requestJson(server.baseUrl, '/api/admin/raids', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ id: 'r-test-lab', name: '测试团本', patch: '12.0.test' }),
  })
  assert.equal(raid.res.status, 201)
  assert.equal(raid.body.id, 'r-test-lab')

  const boss = await requestJson(server.baseUrl, '/api/admin/bosses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ id: 'b-test-lab-one', raidId: 'r-test-lab', name: '测试一号', order: 1 }),
  })
  assert.equal(boss.res.status, 201)
  assert.equal(boss.body.raidId, 'r-test-lab')

  const raidDetail = await requestJson(server.baseUrl, '/api/raids/r-test-lab')
  assert.equal(raidDetail.res.status, 200)
  assert.equal(raidDetail.body.bosses.some((item) => item.id === 'b-test-lab-one'), true)

  const created = await requestJson(server.baseUrl, '/api/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      title: '关联 BOSS 的板',
      raidId: 'r-test-lab',
      bossId: 'b-test-lab-one',
      difficulty: 'mythic',
      seasonVersion: '12.0.test',
      description: '用于删除校验',
      contentText: 'P1 测试',
      authorId: 'a-mirror',
    }),
  })
  assert.equal(created.res.status, 201)

  const mismatchedCreate = await requestJson(server.baseUrl, '/api/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      title: '错配 BOSS 的板',
      raidId: 'r-voidspire',
      bossId: 'b-test-lab-one',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: '不应创建',
      contentText: 'P1 错配',
      authorId: 'a-mirror',
    }),
  })
  assert.equal(mismatchedCreate.res.status, 400)
  assert.equal(mismatchedCreate.body.error, '字段无效：bossId 不属于所选团本')

  const mismatchedUpdate = await requestJson(server.baseUrl, `/api/boards/${created.body.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ raidId: 'r-voidspire' }),
  })
  assert.equal(mismatchedUpdate.res.status, 400)
  assert.equal(mismatchedUpdate.body.error, '字段无效：bossId 不属于所选团本')

  const blockedBossDelete = await requestJson(server.baseUrl, '/api/admin/bosses/b-test-lab-one', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(blockedBossDelete.res.status, 409)

  const blockedRaidDelete = await requestJson(server.baseUrl, '/api/admin/raids/r-test-lab', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(blockedRaidDelete.res.status, 409)
})
