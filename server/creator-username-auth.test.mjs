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
  const approval = await approveNextPendingForAuthor(server, admin, authorId)
  return { admin, submission: approval.submission, approval }
}

async function approveNextPendingForAuthor(server, admin, authorId) {
  const submissions = await adminSubmissions(server.baseUrl, admin)
  const submission = submissions.find((item) => item.authorId === authorId && item.status === 'pending')
  assert.ok(submission)
  const approve = await requestJson(server.baseUrl, `/api/admin/submissions/${submission.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ mode: 'createAuthor' }),
  })
  assert.equal(approve.res.status, 200)
  assert.equal(approve.body.author.visibility, 'approved')
  return approve.body
}

async function submitCreatorReview(server, token, suffix) {
  const result = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: `创作者审核投稿 ${suffix}`,
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: `第 ${suffix} 次审核投稿`,
      contentText: `P1 分散 ${suffix}\nP2 集合 ${suffix}`,
      submitterName: '用户名创作者',
      wantsCreatorProfile: false,
    }),
  })
  assert.equal(result.res.status, 201)
  assert.equal(result.body.status, 'pending')
  return result.body
}

async function approveCreatorUntilTrusted(server, application) {
  const { admin } = await approveCreatorApplication(server, application)
  await submitCreatorReview(server, application.creatorAuth.token, 'two')
  const second = await approveNextPendingForAuthor(server, admin, application.creatorAuth.author.id)
  assert.equal(second.creatorAccount.trustLevel, 'review')
  await submitCreatorReview(server, application.creatorAuth.token, 'three')
  const third = await approveNextPendingForAuthor(server, admin, application.creatorAuth.author.id)
  assert.equal(third.creatorAccount.trustLevel, 'trusted')
  assert.equal(third.creatorAccount.approvedSubmissionCount, 3)
  return { admin, approval: third }
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

test('creator can see their own submission review progress', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const application = await submitCreatorApplication(server)
  const token = application.creatorAuth.token

  const pending = await requestJson(server.baseUrl, '/api/creator/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(pending.res.status, 200)
  assert.equal(pending.body.length, 1)
  assert.equal(pending.body[0].title, '用户名创作者投稿')
  assert.equal(pending.body[0].status, 'pending')
  assert.equal(pending.body[0].boardId, undefined)
  assert.equal(pending.body[0].description, '用于用户名创作者申请的投稿')
  assert.equal(pending.body[0].contentText, 'P1 分散\nP2 集合')
  assert.equal(pending.body[0].submitterName, '用户名创作者')

  const { admin, approval } = await approveCreatorApplication(server, application)
  const approved = await requestJson(server.baseUrl, '/api/creator/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(approved.res.status, 200)
  assert.equal(approved.body[0].status, 'approved')
  assert.equal(approved.body[0].boardId, approval.board.id)

  const rejectedSubmission = await submitCreatorReview(server, token, 'rejected')
  const rejected = await requestJson(server.baseUrl, `/api/admin/submissions/${rejectedSubmission.id}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ note: '请补充站位说明' }),
  })
  assert.equal(rejected.res.status, 200)

  const tracked = await requestJson(server.baseUrl, '/api/creator/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(tracked.res.status, 200)
  assert.equal(tracked.body[0].status, 'rejected')
  assert.equal(tracked.body[0].reviewNote, '请补充站位说明')
  assert.equal(tracked.body.some((item) => item.id === application.id && item.status === 'approved'), true)
})

test('creator can withdraw their own pending submission before admin review', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const otherApplication = await submitCreatorApplication(server, {
    title: '其他创作者投稿',
    contentText: 'P1 其他创作者\nP2 集合',
    creatorUsername: 'other_creator',
    submitterName: '其他创作者',
  })
  const admin = await adminToken(server.baseUrl)

  const otherWithdraw = await requestJson(
    server.baseUrl,
    `/api/creator/submissions/${application.id}/withdraw`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${otherApplication.creatorAuth.token}` },
    },
  )
  assert.equal(otherWithdraw.res.status, 404)

  const withdraw = await requestJson(
    server.baseUrl,
    `/api/creator/submissions/${application.id}/withdraw`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    },
  )
  assert.equal(withdraw.res.status, 200)
  assert.equal(withdraw.body.status, 'withdrawn')
  assert.ok(withdraw.body.reviewedAt)

  const tracked = await requestJson(server.baseUrl, '/api/creator/submissions', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(tracked.res.status, 200)
  assert.equal(tracked.body[0].status, 'withdrawn')

  const approve = await requestJson(server.baseUrl, `/api/admin/submissions/${application.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ mode: 'createAuthor' }),
  })
  assert.equal(approve.res.status, 409)
  assert.equal(approve.body.error, '该投稿已处理')

  const secondWithdraw = await requestJson(
    server.baseUrl,
    `/api/creator/submissions/${application.id}/withdraw`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    },
  )
  assert.equal(secondWithdraw.res.status, 409)
  assert.equal(secondWithdraw.body.error, '只有待审投稿可以撤回')

  const logs = await requestJson(server.baseUrl, '/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(logs.res.status, 200)
  assert.equal(logs.body[0].action, 'creator_submission_withdraw')
  assert.equal(logs.body[0].actorType, 'creator')
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

test('creator can change password without losing current session', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)

  const wrongCurrent = await requestJson(server.baseUrl, '/api/creator/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      currentPassword: 'wrong-password',
      nextPassword: 'new-creator-password-456',
    }),
  })
  assert.equal(wrongCurrent.res.status, 400)
  assert.equal(wrongCurrent.body.error, '当前密码不正确')

  const samePassword = await requestJson(server.baseUrl, '/api/creator/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      currentPassword: 'creator-password-123',
      nextPassword: 'creator-password-123',
    }),
  })
  assert.equal(samePassword.res.status, 400)
  assert.equal(samePassword.body.error, '新密码不能和当前密码相同')

  const update = await requestJson(server.baseUrl, '/api/creator/password', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      currentPassword: 'creator-password-123',
      nextPassword: 'new-creator-password-456',
    }),
  })
  assert.equal(update.res.status, 200)
  assert.equal(update.body.ok, true)
  assert.equal(update.body.revokedOtherSessions, true)

  const currentSession = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(currentSession.res.status, 200)
  assert.equal(currentSession.body.user.username, 'creator_one')

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

  const admin = await adminToken(server.baseUrl)
  const logs = await requestJson(server.baseUrl, '/api/admin/audit-logs', {
    headers: { Authorization: `Bearer ${admin}` },
  })
  assert.equal(logs.res.status, 200)
  assert.equal(logs.body[0].action, 'creator_password_update')
  assert.equal(logs.body[0].actorType, 'creator')
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
  assert.equal(directCreate.res.status, 403)
  assert.equal(directCreate.body.error, '完成 3 次审核通过后才能直接发布战术板')
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
  const { admin } = await approveCreatorUntilTrusted(server, application)

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

test('creator cannot republish a board hidden by admin report handling', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const { admin } = await approveCreatorUntilTrusted(server, application)

  const create = await requestJson(server.baseUrl, '/api/creator/boards', {
    method: 'POST',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({
      title: '会被管理员隐藏的创作者板',
      raidId: 'r-voidspire',
      bossId: 'b-averzian',
      difficulty: 'mythic',
      seasonVersion: 'S3',
      description: '举报后不能被创作者自行恢复',
      contentText: 'P1 分散\nP2 集合',
    }),
  })
  assert.equal(create.res.status, 201)
  assert.equal(create.body.hiddenBy, null)

  const report = await requestJson(server.baseUrl, `/api/boards/${create.body.id}/reports`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'wrong-info', detail: '战术内容过期' }),
  })
  assert.equal(report.res.status, 201)

  const hide = await requestJson(server.baseUrl, `/api/admin/reports/${report.body.id}/hide-board`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ note: '确认隐藏' }),
  })
  assert.equal(hide.res.status, 200)
  assert.equal(hide.body.status, 'hidden')

  const creatorBoards = await requestJson(server.baseUrl, '/api/creator/boards', {
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
  })
  assert.equal(creatorBoards.res.status, 200)
  const hiddenBoard = creatorBoards.body.find((item) => item.id === create.body.id)
  assert.equal(hiddenBoard.isHidden, true)
  assert.equal(hiddenBoard.hiddenBy, 'admin')

  const republish = await requestJson(server.baseUrl, `/api/creator/boards/${create.body.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${application.creatorAuth.token}` },
    body: JSON.stringify({ isHidden: false }),
  })
  assert.equal(republish.res.status, 403)
  assert.equal(republish.body.error, '该战术板已被管理员隐藏，不能自行恢复')

  const publicBoard = await requestJson(server.baseUrl, `/api/boards/${create.body.id}`)
  assert.equal(publicBoard.res.status, 404)
})

test('approved creator cannot update another author board', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())
  const application = await submitCreatorApplication(server)
  const { admin } = await approveCreatorUntilTrusted(server, application)

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
