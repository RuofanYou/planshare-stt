import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import net from 'node:net'

const ADMIN_PASSWORD = 'test-admin-password'

async function getFreePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  server.close()
  await once(server, 'close')
  return port
}

async function startServer() {
  const port = await getFreePort()
  const root = mkdtempSync(join(tmpdir(), 'planshare-submissions-'))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: join(root, 'planshare.db'),
      ADMIN_PASSWORD,
      CORS_ORIGINS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })

  const started = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 8000)
    child.stdout.on('data', () => {
      if (output.includes('PlanShare 已启动')) {
        clearTimeout(timer)
        resolve()
      }
    })
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`server exited before start (${code}): ${output}`))
    })
  })
  await started

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    async stop() {
      child.kill('SIGTERM')
      await once(child, 'exit').catch(() => {})
    },
  }
}

async function requestJson(baseUrl, path, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: init.body
      ? { 'Content-Type': 'application/json', ...init.headers }
      : init.headers,
  })
  let body = null
  try {
    body = await res.json()
  } catch {
    // ignore non-JSON bodies in negative assertions
  }
  return { res, body }
}

async function adminToken(baseUrl) {
  const { res, body } = await requestJson(baseUrl, '/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  assert.equal(res.status, 200)
  assert.match(body.token, /^[a-f0-9]+$/)
  return body.token
}

function validSubmission(overrides = {}) {
  return {
    title: '测试投稿战术板',
    raidId: 'r-voidspire',
    bossId: 'b-averzian',
    difficulty: 'mythic',
    seasonVersion: 'S3',
    description: '用于审核队列的测试投稿',
    contentText: 'P1 分散\nP2 集合',
    submitterName: '投稿作者',
    wantsCreatorProfile: false,
    ...overrides,
  }
}

test('visitor submission is stored as pending and visible only to admin queue', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const { res, body } = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validSubmission()),
  })

  assert.equal(res.status, 201)
  assert.equal(body.status, 'pending')
  assert.equal(body.submitterName, '投稿作者')

  const publicBoards = await requestJson(server.baseUrl, '/api/boards')
  assert.equal(publicBoards.body.some((board) => board.id === body.id), false)

  const denied = await requestJson(server.baseUrl, '/api/admin/submissions')
  assert.equal(denied.res.status, 401)

  const token = await adminToken(server.baseUrl)
  const queue = await requestJson(server.baseUrl, '/api/admin/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(queue.res.status, 200)
  assert.equal(queue.body.some((item) => item.id === body.id), true)
})

test('creator profile requests require contact information', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const { res, body } = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validSubmission({ wantsCreatorProfile: true, contact: '' })),
  })

  assert.equal(res.status, 400)
  assert.match(body.error, /contact/)
})

test('visitor submissions can omit season version', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const input = validSubmission()
  delete input.seasonVersion
  const { res, body } = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  assert.equal(res.status, 201)
  assert.equal(body.seasonVersion, '12.0.0')
})

test('visitor submissions can omit description', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const input = validSubmission()
  delete input.description
  const { res, body } = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(input),
  })

  assert.equal(res.status, 201)
  assert.equal(body.description, '')
})

test('visitor submissions require a boss', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const { res, body } = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validSubmission({ bossId: null })),
  })

  assert.equal(res.status, 400)
  assert.match(body.error, /bossId/)
})

test('admin approval can create an author and publish a board', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const token = await adminToken(server.baseUrl)

  const created = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(
      validSubmission({
        wantsCreatorProfile: true,
        contact: 'BattleTag#1234',
        creatorBio: '专注史诗团本',
        guildName: '测试公会',
      }),
    ),
  })

  const approved = await requestJson(server.baseUrl, `/api/admin/submissions/${created.body.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'createAuthor', isFeatured: true }),
  })

  assert.equal(approved.res.status, 200)
  assert.equal(approved.body.submission.status, 'approved')
  assert.equal(approved.body.author.name, '投稿作者')
  assert.equal(approved.body.board.title, '测试投稿战术板')
  assert.equal(approved.body.board.isFeatured, true)

  const board = await requestJson(server.baseUrl, `/api/boards/${approved.body.board.id}`)
  assert.equal(board.res.status, 200)
  assert.equal(board.body.author.name, '投稿作者')
})

test('admin rejection and spam actions do not publish boards', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const token = await adminToken(server.baseUrl)

  const rejectTarget = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validSubmission({ title: '会被驳回' })),
  })
  const spamTarget = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validSubmission({ title: '会被标垃圾' })),
  })

  const rejected = await requestJson(
    server.baseUrl,
    `/api/admin/submissions/${rejectTarget.body.id}/reject`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ note: '内容不完整' }),
    },
  )
  const spammed = await requestJson(server.baseUrl, `/api/admin/submissions/${spamTarget.body.id}/spam`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  assert.equal(rejected.body.status, 'rejected')
  assert.equal(spammed.body.status, 'spam')

  const boards = await requestJson(server.baseUrl, '/api/boards')
  assert.equal(boards.body.some((board) => board.title === '会被驳回'), false)
  assert.equal(boards.body.some((board) => board.title === '会被标垃圾'), false)
})
