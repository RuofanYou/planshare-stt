import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, isAbsolute, join } from 'node:path'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { ensureDatabasePath } from './db-path.mjs'

test('ensureDatabasePath returns an absolute default path', () => {
  const path = ensureDatabasePath({ envPath: '', serverDir: '/app/server' })

  assert.equal(path, '/app/server/planshare.db')
})

test('ensureDatabasePath accepts an absolute env path and creates its directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'planshare-db-'))
  const path = ensureDatabasePath({ envPath: join(root, 'data', 'planshare.db'), serverDir: root })

  assert.equal(isAbsolute(path), true)
  assert.equal(statSync(dirname(path)).isDirectory(), true)
})

test('ensureDatabasePath rejects relative env paths', () => {
  assert.throws(
    () => ensureDatabasePath({ envPath: 'data/planshare.db', serverDir: '/app/server' }),
    /DATABASE_PATH 必须是绝对路径/,
  )
})
