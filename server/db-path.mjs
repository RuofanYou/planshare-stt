import { dirname, isAbsolute, join } from 'node:path'
import { mkdirSync } from 'node:fs'

export function ensureDatabasePath({ envPath, serverDir }) {
  const path = envPath ? String(envPath).trim() : ''
  if (!path) return join(serverDir, 'planshare.db')
  if (!isAbsolute(path)) {
    throw new Error('DATABASE_PATH 必须是绝对路径，例如 /data/planshare.db')
  }
  mkdirSync(dirname(path), { recursive: true })
  return path
}
