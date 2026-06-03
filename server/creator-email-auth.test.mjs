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

async function startServer(extraEnv = {}) {
  const port = await getFreePort()
  const root = mkdtempSync(join(tmpdir(), 'planshare-creator-email-'))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: join(root, 'planshare.db'),
      ADMIN_PASSWORD,
      CORS_ORIGINS: '',
      MAIL_PROVIDER: 'log',
      FRONTEND_BASE_URL: 'https://front.example',
      ...extraEnv,
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
    output: () => output,
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
    // ignore non-JSON bodies
  }
  return { res, body }
}

async function adminToken(baseUrl) {
  const { res, body } = await requestJson(baseUrl, '/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  assert.equal(res.status, 200)
  return body.token
}

function validCreatorSubmission(overrides = {}) {
  return {
    title: '邮箱创作者投稿',
    raidId: 'r-voidspire',
    bossId: 'b-averzian',
    difficulty: 'mythic',
    seasonVersion: 'S3',
    description: '用于邮箱创作者申请的投稿',
    contentText: 'P1 分散\nP2 集合',
    submitterName: '邮箱创作者',
    wantsCreatorProfile: true,
    contact: 'creator@example.com',
    creatorBio: '开荒战术作者',
    creatorGuildName: '星界开荒团',
    creatorGuildContact: 'BattleTag#1234',
    creatorGuildRecruit: '招收稳定开荒成员',
    ...overrides,
  }
}

function tokenFromOutput(output, path) {
  const match = output.match(new RegExp(`${path.replace('/', '\\/')}\\?token=([a-f0-9]+)`))
  assert.ok(match, `expected ${path} token in output: ${output}`)
  return match[1]
}

async function submitCreatorApplication(server, email = 'creator@example.com') {
  const result = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validCreatorSubmission({ contact: email })),
  })
  assert.equal(result.res.status, 201)
  return result.body
}

async function activateCreator(server, email = 'creator@example.com', password = 'creator-password-123') {
  await submitCreatorApplication(server, email)
  const token = tokenFromOutput(server.output(), '/creator/activate')
  const { res, body } = await requestJson(server.baseUrl, '/api/creator/activate', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
  assert.equal(res.status, 200)
  assert.ok(body.token)
  return body.token
}

async function adminSubmissions(baseUrl, token) {
  const { res, body } = await requestJson(baseUrl, '/api/admin/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(res.status, 200)
  return body
}

test('creator application immediately creates pending email account and logs activation link', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const body = await submitCreatorApplication(server, 'creator@example.com')

  assert.equal(body.contact, 'creator@example.com')
  assert.ok(server.output().includes('/creator/activate?token='))
})

test('creator activation consumes token and returns a creator session', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  await submitCreatorApplication(server, 'creator@example.com')
  const token = tokenFromOutput(server.output(), '/creator/activate')

  const { res, body } = await requestJson(server.baseUrl, '/api/creator/activate', {
    method: 'POST',
    body: JSON.stringify({ token, password: 'creator-password-123' }),
  })

  assert.equal(res.status, 200)
  assert.ok(body.token)
  assert.equal(body.user.email, 'creator@example.com')
  assert.equal(body.user.status, 'active')
})

test('creator can log in with email and password after activation', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  await activateCreator(server, 'creator@example.com', 'creator-password-123')

  const { res, body } = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'creator@example.com', password: 'creator-password-123' }),
  })

  assert.equal(res.status, 200)
  assert.ok(body.token)

  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${body.token}` },
  })
  assert.equal(me.res.status, 200)
  assert.equal(me.body.user.email, 'creator@example.com')
  assert.equal(me.body.user.status, 'active')
  assert.equal(me.body.author.visibility, 'semi_public')
})

test('forgot password returns neutral response and reset token can set a new password', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  await activateCreator(server, 'creator@example.com', 'creator-password-123')

  const forgot = await requestJson(server.baseUrl, '/api/creator/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'creator@example.com' }),
  })
  assert.equal(forgot.res.status, 200)
  assert.equal(forgot.body.ok, true)
  const token = tokenFromOutput(server.output(), '/creator/reset-password')

  const reset = await requestJson(server.baseUrl, '/api/creator/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password: 'new-password-123' }),
  })
  assert.equal(reset.res.status, 200)

  const login = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'creator@example.com', password: 'new-password-123' }),
  })
  assert.equal(login.res.status, 200)
  assert.ok(login.body.token)
})

test('activated creator can edit semi-public author profile before board approval', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const creatorToken = await activateCreator(server, 'creator@example.com', 'creator-password-123')

  const update = await requestJson(server.baseUrl, '/api/creator/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({
      bio: 'M团战术作者',
      guildName: '星界开荒团',
      guildRecruit: '招收稳定开荒成员',
    }),
  })

  assert.equal(update.res.status, 200)
  assert.equal(update.body.author.bio, 'M团战术作者')
  assert.equal(update.body.author.guildName, '星界开荒团')
  assert.equal(update.body.author.visibility, 'semi_public')
})

test('admin approval promotes creator author and publishes board', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const creatorToken = await activateCreator(server, 'creator@example.com', 'creator-password-123')
  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${creatorToken}` },
  })
  const authorId = me.body.author.id
  const admin = await adminToken(server.baseUrl)
  const submissions = await adminSubmissions(server.baseUrl, admin)
  const submission = submissions.find((item) => item.authorId === authorId)
  assert.ok(submission)

  const approve = await requestJson(server.baseUrl, `/api/admin/submissions/${submission.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ mode: 'createAuthor' }),
  })

  assert.equal(approve.res.status, 200)
  assert.equal(approve.body.author.id, authorId)
  assert.equal(approve.body.author.visibility, 'approved')
  assert.equal(approve.body.board.authorId, authorId)
})

test('legacy wechat login endpoints are not registered', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const start = await requestJson(server.baseUrl, '/api/auth/wechat/start')
  const callback = await requestJson(server.baseUrl, '/api/auth/wechat/callback?code=x&state=y')

  assert.equal(start.res.status, 404)
  assert.equal(callback.res.status, 404)
})
