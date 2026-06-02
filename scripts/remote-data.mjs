#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENV_ID = 'planshare-d4gi9p3web9f2c235'
const SERVICE_NAME = 'planshare'
const API_BASE = 'https://planshare-264988-8-1387201447.sh.run.tcloudbase.com'

function getAdminPassword() {
  const raw = execFileSync('tcb', [
    'api',
    'tcbr',
    'DescribeCloudRunServerDetail',
    '--api-version',
    '2022-02-17',
    '--body',
    JSON.stringify({ EnvId: ENV_ID, ServerName: SERVICE_NAME }),
    '--json',
  ], { encoding: 'utf8' })
  const detail = JSON.parse(raw.slice(raw.indexOf('{')))
  const envParams = JSON.parse(detail.data.ServerConfig.EnvParams || '{}')
  if (!envParams.ADMIN_PASSWORD) {
    throw new Error('远端未配置 ADMIN_PASSWORD，无法自动导出/导入')
  }
  return envParams.ADMIN_PASSWORD
}

async function jsonFetch(path, init) {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`)
  return res.json()
}

async function optionalJsonFetch(path, init, fallback) {
  const res = await fetch(`${API_BASE}${path}`, init)
  if (res.status === 404) return fallback
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${await res.text()}`)
  return res.json()
}

async function login() {
  const result = await jsonFetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: getAdminPassword() }),
  })
  return result.token
}

async function exportRemote() {
  const token = await login()
  const auth = { Authorization: `Bearer ${token}` }
  const raids = await jsonFetch('/api/raids')
  const raidDetails = await Promise.all(raids.map((raid) => jsonFetch(`/api/raids/${encodeURIComponent(raid.id)}`)))
  const bosses = raidDetails.flatMap((detail) => detail.bosses)
  const authors = await jsonFetch('/api/admin/authors', { headers: auth })
  const boards = await jsonFetch('/api/admin/boards', { headers: auth })
  const submissions = await optionalJsonFetch('/api/admin/submissions', { headers: auth }, [])
  const backup = {
    exportedAt: new Date().toISOString(),
    source: API_BASE,
    counts: {
      raids: raids.length,
      bosses: bosses.length,
      authors: authors.length,
      boards: boards.length,
      submissions: submissions.length,
    },
    raids,
    bosses,
    authors,
    boards,
    submissions,
  }
  mkdirSync('backups', { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = join('backups', `remote-${stamp}.json`)
  writeFileSync(path, JSON.stringify(backup, null, 2))
  console.log(JSON.stringify({ path, counts: backup.counts }))
}

async function importRemote(path) {
  const backupPath = path || latestBackupPath()
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'))
  const token = await login()
  const result = await jsonFetch('/api/admin/import', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raids: backup.raids,
      bosses: backup.bosses,
      authors: backup.authors,
      boards: backup.boards,
      submissions: backup.submissions ?? [],
    }),
  })
  console.log(JSON.stringify({ backupPath, result }))
}

function latestBackupPath() {
  const backups = readdirSync('backups').filter((name) => name.startsWith('remote-') && name.endsWith('.json')).sort()
  if (backups.length === 0) throw new Error('backups/ 下没有 remote-*.json')
  return join('backups', backups.at(-1))
}

const command = process.argv[2]
if (command === 'export') {
  await exportRemote()
} else if (command === 'import') {
  await importRemote(process.argv[3])
} else {
  console.error('用法：node scripts/remote-data.mjs export | import [backup.json]')
  process.exit(1)
}
