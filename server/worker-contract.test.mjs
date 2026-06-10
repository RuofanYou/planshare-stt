import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { promisify } from 'node:util'
import { once } from 'node:events'
import {
  ADMIN_PASSWORD,
  getFreePort,
  requestJson,
  startServer,
} from './test-helpers.mjs'

const execFileAsync = promisify(execFile)

function contractShape(value) {
  if (Array.isArray(value)) return value.length > 0 ? [contractShape(value[0])] : []
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, contractShape(value[key])]),
    )
  }
  if (value === null) return 'null'
  return typeof value
}

async function runWrangler(args, options = {}) {
  const { stdout, stderr } = await execFileAsync('npx', ['wrangler', ...args], {
    cwd: join(import.meta.dirname, '..'),
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  })
  return `${stdout}${stderr}`
}

async function startWorkerDev(persistDir) {
  const port = await getFreePort()
  const child = spawn('npx', [
    'wrangler',
    'dev',
    '--local',
    '--persist-to',
    persistDir,
    '--ip',
    '127.0.0.1',
    '--port',
    String(port),
    '--var',
    `ADMIN_PASSWORD:${ADMIN_PASSWORD}`,
    '--log-level',
    'error',
  ], {
    cwd: join(import.meta.dirname, '..'),
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (chunk) => {
    output += chunk.toString()
  })
  child.stderr.on('data', (chunk) => {
    output += chunk.toString()
  })

  const baseUrl = `http://127.0.0.1:${port}`
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) break
    try {
      const res = await fetch(`${baseUrl}/api/raids`)
      if (res.ok) return {
        baseUrl,
        output: () => output,
        async stop() {
          if (child.exitCode !== null) return
          child.kill('SIGTERM')
          await once(child, 'exit').catch(() => {})
        },
      }
    } catch {
      // Wait until wrangler binds the local port.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  child.kill('SIGTERM')
  throw new Error(`wrangler dev did not start: ${output}`)
}

test('Fastify and Worker core read APIs keep the same HTTP response structure', async (t) => {
  const fastify = await startServer()
  t.after(() => fastify.stop())

  const persistDir = mkdtempSync(join(tmpdir(), 'planshare-worker-contract-'))
  await runWrangler(['d1', 'execute', 'planshare', '--local', '--persist-to', persistDir, '--file', 'worker/schema.sql'])
  await runWrangler(['d1', 'execute', 'planshare', '--local', '--persist-to', persistDir, '--file', 'worker/seed.sql'])

  const worker = await startWorkerDev(persistDir)
  t.after(() => worker.stop())

  for (const path of [
    '/api/raids',
    '/api/raids/r-voidspire',
    '/api/boards',
    '/api/boards/p-midnight-m9',
    '/api/authors',
    '/api/authors/a-stt',
  ]) {
    const fastifyResult = await requestJson(fastify.baseUrl, path)
    const workerResult = await requestJson(worker.baseUrl, path)
    assert.equal(workerResult.res.status, fastifyResult.res.status, path)
    assert.deepEqual(contractShape(workerResult.body), contractShape(fastifyResult.body), path)
  }

  const schemaOutput = await runWrangler([
    'd1',
    'execute',
    'planshare',
    '--local',
    '--persist-to',
    persistDir,
    '--command',
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('rate_limits', 'audit_logs', 'reports') ORDER BY name",
    '--json',
  ])
  const parsed = JSON.parse(schemaOutput.slice(schemaOutput.indexOf('[')))
  const tableNames = parsed[0].results.map((row) => row.name)
  assert.deepEqual(tableNames, ['audit_logs', 'rate_limits', 'reports'])
})
