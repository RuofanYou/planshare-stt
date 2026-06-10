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
  const root = mkdtempSync(join(tmpdir(), 'planshare-creator-username-'))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: join(root, 'planshare.db'),
      ADMIN_PASSWORD,
      CORS_ORIGINS: '',
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
    title: '用户名创作者投稿',
    raidId: 'r-voidspire',
    bossId: 'b-averzian',
    difficulty: 'mythic',
    seasonVersion: 'S3',
    description: '用于用户名创作者申请的投稿',
    contentText: 'P1 分散\nP2 集合',
    submitterName: '用户名创作者',
    wantsCreatorProfile: true,
    creatorUsername: 'creator_one',
    creatorPassword: 'creator-password-123',
    contact: 'BattleTag#1234',
    creatorBio: '开荒战术作者',
    creatorGuildName: '星界开荒团',
    creatorGuildContact: 'BattleTag#1234',
    creatorGuildRecruit: '招收稳定开荒成员',
    ...overrides,
  }
}

async function submitCreatorApplication(server, overrides = {}) {
  const result = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validCreatorSubmission(overrides)),
  })
  assert.equal(result.res.status, 201)
  return result.body
}

async function loginCreator(server, username = 'creator_one', password = 'creator-password-123') {
  const { res, body } = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  assert.equal(res.status, 200)
  assert.ok(body.token)
  return body
}

async function adminSubmissions(baseUrl, token) {
  const { res, body } = await requestJson(baseUrl, '/api/admin/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(res.status, 200)
  return body
}

async function approveCreatorApplication(server, application) {
  const authorId = application.creatorAuth.author.id
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
  assert.equal(approve.body.author.visibility, 'approved')
  return { admin, submission, approval: approve.body }
}

test('creator application creates active username account, semi-public author, session, and pending board', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const body = await submitCreatorApplication(server)

  assert.equal(body.status, 'pending')
  assert.equal(body.contact, 'BattleTag#1234')
  assert.equal(body.creatorActivationUrl, undefined)
  assert.ok(body.creatorAuth.token)
  assert.equal(body.creatorAuth.user.username, 'creator_one')
  assert.equal(body.creatorAuth.user.status, 'active')
  assert.equal(body.creatorAuth.author.visibility, 'semi_public')
  assert.equal(body.authorId, body.creatorAuth.author.id)
  assert.equal(server.output().includes('/creator/activate?token='), false)

  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${body.creatorAuth.token}` },
  })
  assert.equal(me.res.status, 200)
  assert.equal(me.body.user.username, 'creator_one')
  assert.equal(me.body.author.visibility, 'semi_public')
})

test('duplicate creator username returns 409', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  await submitCreatorApplication(server)

  const duplicate = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validCreatorSubmission({
      title: '重复用户名投稿',
      creatorUsername: 'CREATOR_ONE',
    })),
  })

  assert.equal(duplicate.res.status, 409)
  assert.equal(duplicate.body.error, '这个用户名已被占用')
})

test('invalid creator username is rejected before account creation', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const result = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validCreatorSubmission({ creatorUsername: 'Bad Name' })),
  })

  assert.equal(result.res.status, 400)
  assert.equal(result.body.error, '用户名只能包含小写英文、数字、下划线或短横线')
})

test('creator can log in with username and password', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  await submitCreatorApplication(server)

  const login = await loginCreator(server)
  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${login.token}` },
  })

  assert.equal(me.res.status, 200)
  assert.equal(me.body.user.username, 'creator_one')
  assert.equal(me.body.user.status, 'active')
  assert.equal(me.body.author.visibility, 'semi_public')
})

test('creator session survives server restart when the same database is reused', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'planshare-creator-session-'))
  const databasePath = join(root, 'planshare.db')
  const first = await startServer({ DATABASE_PATH: databasePath })
  const application = await submitCreatorApplication(first)
  await first.stop()

  const second = await startServer({ DATABASE_PATH: databasePath })
  t.after(() => second.stop())
  const me = await requestJson(second.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })

  assert.equal(me.res.status, 200)
  assert.equal(me.body.user.username, 'creator_one')
  assert.equal(me.body.author.visibility, 'semi_public')
})

test('creator logout revokes the current persisted session', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)

  const logout = await requestJson(server.baseUrl, '/api/creator/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(logout.res.status, 200)
  assert.equal(logout.body.ok, true)

  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(me.res.status, 401)
})

test('creator login fails with wrong password without revealing username existence', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  await submitCreatorApplication(server)

  const login = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'creator_one', password: 'wrong-password' }),
  })

  assert.equal(login.res.status, 401)
  assert.equal(login.body.error, '用户名或密码错误')
})

test('suspended creator account cannot log in', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const admin = await adminToken(server.baseUrl)

  const suspend = await requestJson(
    server.baseUrl,
    `/api/admin/creator-accounts/${application.creatorAuth.user.id}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${admin}` },
      body: JSON.stringify({ status: 'suspended' }),
    },
  )
  assert.equal(suspend.res.status, 200)
  assert.equal(suspend.body.status, 'suspended')

  const login = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'creator_one', password: 'creator-password-123' }),
  })
  assert.equal(login.res.status, 403)
  assert.equal(login.body.error, '账号已被暂停，请联系管理员')
})

test('admin can list creator accounts and reset a forgotten password', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const admin = await adminToken(server.baseUrl)

  const accounts = await requestJson(server.baseUrl, '/api/admin/creator-accounts', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(accounts.res.status, 200)
  assert.equal(accounts.body.length, 1)
  assert.equal(accounts.body[0].username, 'creator_one')
  assert.equal(accounts.body[0].author.name, '用户名创作者')
  assert.equal(accounts.body[0].contact, 'BattleTag#1234')
  assert.equal(accounts.body[0].passwordHash, undefined)

  const oldSession = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(oldSession.res.status, 200)

  const reset = await requestJson(
    server.baseUrl,
    `/api/admin/creator-accounts/${application.creatorAuth.user.id}/reset-password`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${admin}` },
      body: JSON.stringify({ password: 'new-creator-password-456' }),
    },
  )
  assert.equal(reset.res.status, 200)
  assert.equal(reset.body.user.username, 'creator_one')
  assert.equal(reset.body.user.passwordHash, undefined)
  assert.equal(reset.body.revokedSessions, true)

  const staleSession = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(staleSession.res.status, 401)

  const oldPasswordLogin = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'creator_one', password: 'creator-password-123' }),
  })
  assert.equal(oldPasswordLogin.res.status, 401)

  const newPasswordLogin = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'creator_one', password: 'new-creator-password-456' }),
  })
  assert.equal(newPasswordLogin.res.status, 200)
  assert.ok(newPasswordLogin.body.token)
})

test('creator can edit only their own semi-public author profile', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)

  const update = await requestJson(server.baseUrl, '/api/creator/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      bio: 'M团战术作者',
      guildName: '星界开荒团',
      guildRecruit: '招收稳定开荒成员',
      visibility: 'approved',
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
  const application = await submitCreatorApplication(server)
  const authorId = application.creatorAuth.author.id
  const admin = await adminToken(server.baseUrl)
  const submissions = await adminSubmissions(server.baseUrl, admin)
  const submission = submissions.find((item) => item.authorId === authorId)
  assert.ok(submission)
  assert.equal(submission.status, 'pending')

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

test('admin approval with existing creator author promotes author approval', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const authorId = application.creatorAuth.author.id
  const admin = await adminToken(server.baseUrl)
  const submissions = await adminSubmissions(server.baseUrl, admin)
  const submission = submissions.find((item) => item.authorId === authorId)
  assert.ok(submission)

  const approve = await requestJson(server.baseUrl, `/api/admin/submissions/${submission.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ mode: 'existingAuthor', authorId }),
  })
  assert.equal(approve.res.status, 200)
  assert.equal(approve.body.author.id, authorId)
  assert.equal(approve.body.author.visibility, 'approved')
  assert.equal(approve.body.board.authorId, authorId)

  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(me.res.status, 200)
  assert.equal(me.body.author.visibility, 'approved')

  const directCreate = await requestJson(server.baseUrl, '/api/creator/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      title: '既有作者过审后直发',
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: '绑定已有作者过审后应可直发',
      contentText: 'P1 分散',
    }),
  })
  assert.equal(directCreate.res.status, 201)
  assert.equal(directCreate.body.authorId, authorId)
})

test('semi-public creator cannot directly publish boards before author approval', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)

  const create = await requestJson(server.baseUrl, '/api/creator/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      title: '未过审直发',
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: '未过审不应直接公开',
      contentText: 'P1 先分散',
    }),
  })

  assert.equal(create.res.status, 403)
  assert.equal(create.body.error, '作者主页通过审核后才能直接发布战术板')
})

test('approved creator can publish, edit, hide, and republish own boards without review', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const { admin } = await approveCreatorApplication(server, application)

  const create = await requestJson(server.baseUrl, '/api/creator/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      title: '创作者直发战术',
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: '无需进入审核队列',
      contentText: 'P1 分散\nP2 集合',
    }),
  })
  assert.equal(create.res.status, 201)
  assert.equal(create.body.authorId, application.creatorAuth.author.id)
  assert.equal(create.body.isHidden, false)

  const submissionsAfterCreate = await adminSubmissions(server.baseUrl, admin)
  assert.equal(submissionsAfterCreate.some((item) => item.title === '创作者直发战术'), false)

  const update = await requestJson(server.baseUrl, `/api/creator/boards/${create.body.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      title: '创作者直发战术 v2',
      contentText: 'P1 分散\nP2 集合\nP3 换边',
      isFeatured: true,
    }),
  })
  assert.equal(update.res.status, 200)
  assert.equal(update.body.title, '创作者直发战术 v2')
  assert.equal(update.body.contentText.includes('P3 换边'), true)
  assert.equal(update.body.isFeatured, false)

  const hide = await requestJson(server.baseUrl, `/api/creator/boards/${create.body.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(hide.res.status, 200)
  assert.equal(hide.body.ok, true)

  const hiddenPublic = await requestJson(server.baseUrl, `/api/boards/${create.body.id}`)
  assert.equal(hiddenPublic.res.status, 404)

  const republish = await requestJson(server.baseUrl, `/api/creator/boards/${create.body.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({ isHidden: false }),
  })
  assert.equal(republish.res.status, 200)
  assert.equal(republish.body.isHidden, false)

  const publicBoard = await requestJson(server.baseUrl, `/api/boards/${create.body.id}`)
  assert.equal(publicBoard.res.status, 200)
  assert.equal(publicBoard.body.board.title, '创作者直发战术 v2')
})

test('approved creator cannot update another author board', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const { admin } = await approveCreatorApplication(server, application)

  const otherAuthor = await requestJson(server.baseUrl, '/api/authors', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ name: '其他作者' }),
  })
  assert.equal(otherAuthor.res.status, 201)
  const otherBoard = await requestJson(server.baseUrl, '/api/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({
      title: '其他作者战术',
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: '不是当前创作者的板',
      contentText: '不可被其他创作者修改',
      authorId: otherAuthor.body.id,
    }),
  })
  assert.equal(otherBoard.res.status, 201)

  const update = await requestJson(server.baseUrl, `/api/creator/boards/${otherBoard.body.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({ title: '越权修改' }),
  })

  assert.equal(update.res.status, 404)
})

test('removed email auth runtime routes are not registered', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const routes = [
    ['/api/creator/auth-capabilities', undefined],
    ['/api/creator/activate', { method: 'POST', body: JSON.stringify({}) }],
    ['/api/creator/resend-activation', { method: 'POST', body: JSON.stringify({}) }],
    ['/api/creator/forgot-password', { method: 'POST', body: JSON.stringify({}) }],
    ['/api/creator/reset-password', { method: 'POST', body: JSON.stringify({}) }],
  ]

  for (const [path, init] of routes) {
    const result = await requestJson(server.baseUrl, path, init)
    assert.equal(result.res.status, 404, path)
  }
})

test('legacy wechat login endpoints are not registered', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const start = await requestJson(server.baseUrl, '/api/auth/wechat/start')
  const callback = await requestJson(server.baseUrl, '/api/auth/wechat/callback?code=x&state=y')

  assert.equal(start.res.status, 404)
  assert.equal(callback.res.status, 404)
})
