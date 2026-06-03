import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import http from 'node:http'
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
  const root = mkdtempSync(join(tmpdir(), 'planshare-wechat-'))
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: join(root, 'planshare.db'),
      ADMIN_PASSWORD,
      CORS_ORIGINS: '',
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
    async stop() {
      child.kill('SIGTERM')
      await once(child, 'exit').catch(() => {})
    },
  }
}

async function startFakeWechat() {
  const port = await getFreePort()
  const calls = []
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`)
    calls.push({ pathname: url.pathname, searchParams: url.searchParams })
    res.setHeader('Content-Type', 'application/json')

    if (url.pathname === '/sns/oauth2/access_token') {
      if (url.searchParams.get('code') !== 'valid-code') {
        res.end(JSON.stringify({ errcode: 40029, errmsg: 'invalid code' }))
        return
      }
      res.end(JSON.stringify({
        access_token: 'wechat-access-token',
        expires_in: 7200,
        refresh_token: 'wechat-refresh-token',
        openid: 'openid-1',
        scope: 'snsapi_login',
        unionid: 'unionid-1',
      }))
      return
    }

    if (url.pathname === '/sns/userinfo') {
      res.end(JSON.stringify({
        openid: 'openid-1',
        unionid: 'unionid-1',
        nickname: '微信创作者',
        headimgurl: 'https://img.example/avatar.jpg',
      }))
      return
    }

    res.statusCode = 404
    res.end(JSON.stringify({ error: 'not found' }))
  })

  server.listen(port, '127.0.0.1')
  await once(server, 'listening')
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    calls,
    async stop() {
      server.close()
      await once(server, 'close').catch(() => {})
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

function validSubmission(overrides = {}) {
  return {
    title: '微信创作者投稿',
    raidId: 'r-voidspire',
    bossId: 'b-averzian',
    difficulty: 'mythic',
    seasonVersion: 'S3',
    description: '用于微信创作者绑定的投稿',
    contentText: 'P1 分散\nP2 集合',
    submitterName: '微信创作者',
    wantsCreatorProfile: true,
    contact: '微信已登录',
    ...overrides,
  }
}

async function creatorTokenFromWechatLogin(server) {
  const start = await fetch(`${server.baseUrl}/api/auth/wechat/start?returnTo=/creator`, {
    redirect: 'manual',
  })
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  const callback = await fetch(`${server.baseUrl}/api/auth/wechat/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
  })
  const redirect = new URL(callback.headers.get('location'))
  return new URLSearchParams(redirect.hash.slice(1)).get('creator_token')
}

test('wechat login start returns a clear setup error when credentials are missing', async (t) => {
  const server = await startServer()
  t.after(() => server.stop())

  const { res, body } = await requestJson(server.baseUrl, '/api/auth/wechat/start')

  assert.equal(res.status, 501)
  assert.match(body.error, /WECHAT_APP_ID/)
})

test('wechat login start redirects to the official qrconnect endpoint', async (t) => {
  const server = await startServer({
    WECHAT_APP_ID: 'wx-test-app',
    WECHAT_APP_SECRET: 'wx-test-secret',
    AUTH_STATE_SECRET: 'state-secret',
    FRONTEND_BASE_URL: 'https://front.example',
  })
  t.after(() => server.stop())

  const res = await fetch(`${server.baseUrl}/api/auth/wechat/start?returnTo=/creator`, {
    redirect: 'manual',
  })
  const location = res.headers.get('location')
  assert.equal(res.status, 302)

  const url = new URL(location)
  assert.equal(url.origin + url.pathname, 'https://open.weixin.qq.com/connect/qrconnect')
  assert.equal(url.searchParams.get('appid'), 'wx-test-app')
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('scope'), 'snsapi_login')
  assert.match(url.searchParams.get('redirect_uri'), /\/api\/auth\/wechat\/callback$/)
  assert.ok(url.searchParams.get('state'))
})

test('wechat callback creates a creator session from the authorized identity', async (t) => {
  const fakeWechat = await startFakeWechat()
  t.after(() => fakeWechat.stop())
  const server = await startServer({
    WECHAT_APP_ID: 'wx-test-app',
    WECHAT_APP_SECRET: 'wx-test-secret',
    WECHAT_API_BASE: fakeWechat.baseUrl,
    AUTH_STATE_SECRET: 'state-secret',
    FRONTEND_BASE_URL: 'https://front.example',
  })
  t.after(() => server.stop())

  const start = await fetch(`${server.baseUrl}/api/auth/wechat/start?returnTo=/creator`, {
    redirect: 'manual',
  })
  const state = new URL(start.headers.get('location')).searchParams.get('state')

  const callback = await fetch(`${server.baseUrl}/api/auth/wechat/callback?code=valid-code&state=${encodeURIComponent(state)}`, {
    redirect: 'manual',
  })
  assert.equal(callback.status, 302)

  const location = callback.headers.get('location')
  const redirect = new URL(location)
  assert.equal(redirect.origin + redirect.pathname, 'https://front.example/creator')
  const token = new URLSearchParams(redirect.hash.slice(1)).get('creator_token')
  assert.match(token, /^[a-f0-9]+$/)

  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(me.res.status, 200)
  assert.equal(me.body.user.provider, 'wechat')
  assert.equal(me.body.user.openid, 'openid-1')
  assert.equal(me.body.user.unionid, 'unionid-1')
  assert.equal(me.body.user.nickname, '微信创作者')
  assert.equal(me.body.user.avatarUrl, 'https://img.example/avatar.jpg')
  assert.equal(me.body.author, null)
})

test('wechat callback rejects an invalid state', async (t) => {
  const server = await startServer({
    WECHAT_APP_ID: 'wx-test-app',
    WECHAT_APP_SECRET: 'wx-test-secret',
    AUTH_STATE_SECRET: 'state-secret',
    FRONTEND_BASE_URL: 'https://front.example',
  })
  t.after(() => server.stop())

  const { res, body } = await requestJson(server.baseUrl, '/api/auth/wechat/callback?code=valid-code&state=bad-state')

  assert.equal(res.status, 400)
  assert.match(body.error, /state/)
})

test('approved submission from a logged creator binds the author to that wechat user', async (t) => {
  const fakeWechat = await startFakeWechat()
  t.after(() => fakeWechat.stop())
  const server = await startServer({
    WECHAT_APP_ID: 'wx-test-app',
    WECHAT_APP_SECRET: 'wx-test-secret',
    WECHAT_API_BASE: fakeWechat.baseUrl,
    AUTH_STATE_SECRET: 'state-secret',
    FRONTEND_BASE_URL: 'https://front.example',
  })
  t.after(() => server.stop())

  const creatorToken = await creatorTokenFromWechatLogin(server)
  const created = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify(validSubmission()),
  })
  assert.equal(created.res.status, 201)
  assert.match(created.body.creatorUserId, /^u-/)

  const token = await adminToken(server.baseUrl)
  const approved = await requestJson(server.baseUrl, `/api/admin/submissions/${created.body.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mode: 'createAuthor' }),
  })
  assert.equal(approved.res.status, 200)

  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${creatorToken}` },
  })
  assert.equal(me.res.status, 200)
  assert.equal(me.body.author.id, approved.body.author.id)
  assert.equal(me.body.author.name, '微信创作者')
})
