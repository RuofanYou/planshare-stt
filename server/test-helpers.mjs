import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import net from 'node:net'

export const ADMIN_PASSWORD = 'test-admin-password'

export async function getFreePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  server.close()
  await once(server, 'close')
  return port
}

export async function startServer(extraEnv = {}) {
  const port = await getFreePort()
  const root = mkdtempSync(join(tmpdir(), 'planshare-test-'))
  const databasePath = extraEnv.DATABASE_PATH ?? join(root, 'planshare.db')
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: join(import.meta.dirname, '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATABASE_PATH: databasePath,
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
    const timer = setTimeout(() => reject(new Error(`server did not start: ${output}`)), 10000)
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
    databasePath,
    output: () => output,
    async stop() {
      if (child.exitCode !== null) return
      child.kill('SIGTERM')
      await once(child, 'exit').catch(() => {})
    },
  }
}

export async function requestJson(baseUrl, path, init = {}) {
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
    // negative assertions may not return JSON
  }
  return { res, body }
}

export async function adminToken(baseUrl) {
  const { res, body } = await requestJson(baseUrl, '/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  })
  assert.equal(res.status, 200)
  assert.match(body.token, /^[a-f0-9]+$/)
  return body.token
}

export function validSubmission(overrides = {}) {
  return {
    title: 'UGC 测试投稿',
    raidId: 'r-voidspire',
    bossId: 'b-averzian',
    difficulty: 'mythic',
    seasonVersion: 'S3',
    description: '用于 UGC readiness 的测试投稿',
    contentText: 'P1 分散\nP2 集合',
    submitterName: 'UGC 作者',
    wantsCreatorProfile: false,
    ...overrides,
  }
}

export async function createSubmission(server, overrides = {}, init = {}) {
  const result = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    ...init,
    body: JSON.stringify(validSubmission(overrides)),
  })
  assert.equal(result.res.status, 201)
  return result.body
}
