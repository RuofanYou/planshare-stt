/**
 * PlanShare 后端（Fastify + better-sqlite3，ESM 纯 JS）。
 *
 * 职责：
 *   - 打开 / 建表 SQLite（server/planshare.db）。
 *   - boards 表为空时从 ./seed/seed-data.mjs（单一权威）seed。
 *   - 暴露契约端点，监听 3001。
 *
 * 约定（与前端严格对齐）：
 *   - isHidden 的板一律不返回。
 *   - 列表排序：点赞降序 → 浏览量降序 → updatedAt 降序。
 *   - GET /api/boards/:id 副作用 viewCount += 1；POST like 副作用 likeCount += 1。
 */

import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { raids, bosses, authors, boards } from './seed/seed-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'planshare.db')
// 生产可经环境变量配置端口/绑定地址（容器/托管常用 0.0.0.0 + 平台注入 PORT）。
const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '127.0.0.1'

// 管理员鉴权：单密码 + 内存有效 token 集合（重启即失效）。
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'planshare-admin'
const validTokens = new Set()

// ---------------------------------------------------------------------------
// 数据库：建表 + 按需 seed
// ---------------------------------------------------------------------------

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS raids (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    patch TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bosses (
    id        TEXT PRIMARY KEY,
    raid_id   TEXT NOT NULL,
    name      TEXT NOT NULL,
    "order"   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS authors (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    avatar_url    TEXT,
    bio           TEXT,
    guild_name    TEXT,
    guild_recruit TEXT,
    guild_contact TEXT
  );

  CREATE TABLE IF NOT EXISTS boards (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    raid_id        TEXT NOT NULL,
    boss_id        TEXT,
    difficulty     TEXT NOT NULL,
    season_version TEXT NOT NULL,
    content_text   TEXT NOT NULL,
    import_code    TEXT,
    description    TEXT NOT NULL,
    author_id      TEXT NOT NULL,
    is_hidden      INTEGER NOT NULL DEFAULT 0,
    is_featured    INTEGER NOT NULL DEFAULT 0,
    view_count     INTEGER NOT NULL DEFAULT 0,
    like_count     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );
`)

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM boards').get().n
  if (count > 0) return

  const insertRaid = db.prepare('INSERT INTO raids (id, name, patch) VALUES (@id, @name, @patch)')
  const insertBoss = db.prepare(
    'INSERT INTO bosses (id, raid_id, name, "order") VALUES (@id, @raidId, @name, @order)'
  )
  const insertAuthor = db.prepare(`
    INSERT INTO authors (id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact)
    VALUES (@id, @name, @avatarUrl, @bio, @guildName, @guildRecruit, @guildContact)
  `)
  const insertBoard = db.prepare(`
    INSERT INTO boards (
      id, title, raid_id, boss_id, difficulty, season_version, content_text,
      import_code, description, author_id, is_hidden, is_featured,
      view_count, like_count, created_at, updated_at
    ) VALUES (
      @id, @title, @raidId, @bossId, @difficulty, @seasonVersion, @contentText,
      @importCode, @description, @authorId, @isHidden, @isFeatured,
      @viewCount, @likeCount, @createdAt, @updatedAt
    )
  `)

  const seedAll = db.transaction(() => {
    for (const r of raids) insertRaid.run(r)
    for (const b of bosses) insertBoss.run(b)
    for (const a of authors) {
      insertAuthor.run({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatarUrl ?? null,
        bio: a.bio ?? null,
        guildName: a.guildName ?? null,
        guildRecruit: a.guildRecruit ?? null,
        guildContact: a.guildContact ?? null,
      })
    }
    for (const b of boards) {
      insertBoard.run({
        id: b.id,
        title: b.title,
        raidId: b.raidId,
        bossId: b.bossId ?? null,
        difficulty: b.difficulty,
        seasonVersion: b.seasonVersion,
        contentText: b.contentText,
        importCode: b.importCode ?? null,
        description: b.description,
        authorId: b.authorId,
        isHidden: b.isHidden ? 1 : 0,
        isFeatured: b.isFeatured ? 1 : 0,
        viewCount: b.viewCount,
        likeCount: b.likeCount,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })
    }
  })

  seedAll()
}

seedIfEmpty()

// ---------------------------------------------------------------------------
// 行 → 契约对象 映射（snake_case 列 → camelCase 字段）
// ---------------------------------------------------------------------------

function rowToBoss(row) {
  return { id: row.id, raidId: row.raid_id, name: row.name, order: row.order }
}

function rowToAuthor(row) {
  return {
    id: row.id,
    name: row.name,
    avatarUrl: row.avatar_url ?? undefined,
    bio: row.bio ?? undefined,
    guildName: row.guild_name ?? undefined,
    guildRecruit: row.guild_recruit ?? undefined,
    guildContact: row.guild_contact ?? undefined,
  }
}

function rowToBoard(row) {
  return {
    id: row.id,
    title: row.title,
    raidId: row.raid_id,
    bossId: row.boss_id ?? null,
    difficulty: row.difficulty,
    seasonVersion: row.season_version,
    contentText: row.content_text,
    importCode: row.import_code ?? undefined,
    description: row.description,
    authorId: row.author_id,
    isFeatured: row.is_featured === 1,
    viewCount: row.view_count,
    likeCount: row.like_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// 管理端 Board：在公开形状基础上额外暴露 isHidden 字段。
function rowToAdminBoard(row) {
  return { ...rowToBoard(row), isHidden: row.is_hidden === 1 }
}

// 列表排序：点赞降序 → 浏览量降序 → updatedAt 降序。
const BOARD_ORDER = 'ORDER BY like_count DESC, view_count DESC, updated_at DESC'

// ---------------------------------------------------------------------------
// 预编译语句
// ---------------------------------------------------------------------------

const stmt = {
  allRaids: db.prepare('SELECT * FROM raids'),
  raidById: db.prepare('SELECT * FROM raids WHERE id = ?'),
  // 团本未隐藏板数
  boardCountByRaid: db.prepare(
    'SELECT COUNT(*) AS n FROM boards WHERE raid_id = ? AND is_hidden = 0'
  ),
  bossesByRaid: db.prepare('SELECT * FROM bosses WHERE raid_id = ? ORDER BY "order" ASC'),
  bossById: db.prepare('SELECT * FROM bosses WHERE id = ?'),
  allAuthors: db.prepare('SELECT * FROM authors'),
  authorById: db.prepare('SELECT * FROM authors WHERE id = ?'),
  boardById: db.prepare('SELECT * FROM boards WHERE id = ?'),
  bumpView: db.prepare('UPDATE boards SET view_count = view_count + 1 WHERE id = ?'),
  bumpLike: db.prepare('UPDATE boards SET like_count = like_count + 1 WHERE id = ?'),
  // 管理端：全部板（含隐藏），按 updatedAt 倒序
  allBoardsAdmin: db.prepare('SELECT * FROM boards ORDER BY updated_at DESC'),
  // 某作者名下板数（含隐藏，用于删除前校验与作者列表统计）
  boardCountByAuthor: db.prepare('SELECT COUNT(*) AS n FROM boards WHERE author_id = ?'),
  deleteBoard: db.prepare('DELETE FROM boards WHERE id = ?'),
  insertAuthor: db.prepare(`
    INSERT INTO authors (id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact)
    VALUES (@id, @name, @avatarUrl, @bio, @guildName, @guildRecruit, @guildContact)
  `),
  deleteAuthor: db.prepare('DELETE FROM authors WHERE id = ?'),
  insertBoard: db.prepare(`
    INSERT INTO boards (
      id, title, raid_id, boss_id, difficulty, season_version, content_text,
      import_code, description, author_id, is_hidden, is_featured,
      view_count, like_count, created_at, updated_at
    ) VALUES (
      @id, @title, @raidId, @bossId, @difficulty, @seasonVersion, @contentText,
      NULL, @description, @authorId, 0, @isFeatured,
      0, 0, @createdAt, @updatedAt
    )
  `),
}

// 动态过滤的 boards 列表（排除隐藏 + 可选筛选 + 排序）。
function queryBoards({ raidId, bossId, authorId, featured }) {
  const where = ['is_hidden = 0']
  const params = []
  if (raidId) {
    where.push('raid_id = ?')
    params.push(raidId)
  }
  if (bossId) {
    where.push('boss_id = ?')
    params.push(bossId)
  }
  if (authorId) {
    where.push('author_id = ?')
    params.push(authorId)
  }
  if (featured) {
    where.push('is_featured = 1')
  }
  const sql = `SELECT * FROM boards WHERE ${where.join(' AND ')} ${BOARD_ORDER}`
  return db.prepare(sql).all(...params).map(rowToBoard)
}

// ---------------------------------------------------------------------------
// Fastify 路由
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })
await app.register(cors, { origin: true })

// 生产：同进程托管前端构建产物 dist/（前后端同源，无需 CORS/代理）。
// dev 下没有 dist，跳过；此时前端由 Vite 起在 5173 并经 /api 代理打到这里。
const DIST_DIR = join(__dirname, '..', 'dist')
if (existsSync(DIST_DIR)) {
  await app.register(fastifyStatic, { root: DIST_DIR, prefix: '/' })
  // SPA 回退：非 /api 的 GET 未命中一律返回 index.html，交前端路由处理。
  app.setNotFoundHandler((req, reply) => {
    if (req.raw.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.sendFile('index.html')
    }
    reply.code(404).send({ error: '未找到' })
  })
}

// 受保护路由的 preHandler：校验 Authorization: Bearer <token>。
function requireAuth(req, reply, done) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !validTokens.has(token)) {
    reply.code(401).send({ error: '未授权' })
    return
  }
  done()
}

// POST /api/admin/login -> { token }；密码错 401。
app.post('/api/admin/login', (req, reply) => {
  const { password } = req.body ?? {}
  if (password !== ADMIN_PASSWORD) {
    return reply.code(401).send({ error: '密码错误' })
  }
  const token = randomBytes(24).toString('hex')
  validTokens.add(token)
  return { token }
})

// GET /api/raids -> Raid[]（boardCount = 该团本未隐藏板数）
app.get('/api/raids', () => {
  return stmt.allRaids.all().map((r) => ({
    id: r.id,
    name: r.name,
    patch: r.patch,
    boardCount: stmt.boardCountByRaid.get(r.id).n,
  }))
})

// GET /api/raids/:id -> { raid, bosses }
app.get('/api/raids/:id', (req, reply) => {
  const row = stmt.raidById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'raid not found' })
  const raid = {
    id: row.id,
    name: row.name,
    patch: row.patch,
    boardCount: stmt.boardCountByRaid.get(row.id).n,
  }
  const bossList = stmt.bossesByRaid.all(row.id).map(rowToBoss)
  return { raid, bosses: bossList }
})

// GET /api/boards?raidId=&bossId=&authorId=&featured=1 -> Board[]
app.get('/api/boards', (req) => {
  const { raidId, bossId, authorId, featured } = req.query
  return queryBoards({
    raidId,
    bossId,
    authorId,
    featured: featured === '1' || featured === 'true',
  })
})

// GET /api/boards/:id -> { board, raid, boss, author }；副作用 viewCount += 1
app.get('/api/boards/:id', (req, reply) => {
  const row = stmt.boardById.get(req.params.id)
  if (!row || row.is_hidden === 1) return reply.code(404).send({ error: 'board not found' })
  stmt.bumpView.run(row.id)
  const fresh = stmt.boardById.get(row.id)
  const board = rowToBoard(fresh)
  const raidRow = stmt.raidById.get(fresh.raid_id)
  const raid = raidRow
    ? {
        id: raidRow.id,
        name: raidRow.name,
        patch: raidRow.patch,
        boardCount: stmt.boardCountByRaid.get(raidRow.id).n,
      }
    : null
  const bossRow = fresh.boss_id ? stmt.bossById.get(fresh.boss_id) : null
  const boss = bossRow ? rowToBoss(bossRow) : null
  const authorRow = stmt.authorById.get(fresh.author_id)
  const author = authorRow ? rowToAuthor(authorRow) : null
  return { board, raid, boss, author }
})

// GET /api/authors -> Author[]
app.get('/api/authors', () => {
  return stmt.allAuthors.all().map(rowToAuthor)
})

// GET /api/authors/:id -> { author, boards }
app.get('/api/authors/:id', (req, reply) => {
  const row = stmt.authorById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'author not found' })
  const author = rowToAuthor(row)
  const boardList = queryBoards({ authorId: row.id })
  return { author, boards: boardList }
})

// POST /api/boards/:id/like -> { id, likeCount }（持久化 +1）
app.post('/api/boards/:id/like', (req, reply) => {
  const row = stmt.boardById.get(req.params.id)
  if (!row || row.is_hidden === 1) return reply.code(404).send({ error: 'board not found' })
  stmt.bumpLike.run(row.id)
  const fresh = stmt.boardById.get(row.id)
  return { id: fresh.id, likeCount: fresh.like_count }
})

// POST /api/boards -> 新建 Board（受保护；后端生成 id；viewCount=0, likeCount=0, isHidden=false）
app.post('/api/boards', { preHandler: requireAuth }, (req, reply) => {
  const b = req.body ?? {}
  const required = ['title', 'raidId', 'difficulty', 'seasonVersion', 'contentText', 'authorId']
  for (const key of required) {
    if (b[key] == null || b[key] === '') {
      return reply.code(400).send({ error: `字段缺失：${key}` })
    }
  }
  const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const today = new Date().toISOString().slice(0, 10)
  stmt.insertBoard.run({
    id,
    title: b.title,
    raidId: b.raidId,
    bossId: b.bossId ?? null,
    difficulty: b.difficulty,
    seasonVersion: b.seasonVersion,
    contentText: b.contentText,
    description: b.description ?? '',
    authorId: b.authorId,
    isFeatured: b.isFeatured ? 1 : 0,
    createdAt: today,
    updatedAt: today,
  })
  const fresh = stmt.boardById.get(id)
  return reply.code(201).send(rowToBoard(fresh))
})

// ---------------------------------------------------------------------------
// 受保护：管理端接口（均需 Bearer token）
// ---------------------------------------------------------------------------

// GET /api/admin/boards -> Board[]（含隐藏，每条带 isHidden，按 updatedAt 倒序）
app.get('/api/admin/boards', { preHandler: requireAuth }, () => {
  return stmt.allBoardsAdmin.all().map(rowToAdminBoard)
})

// GET /api/admin/authors -> Author[]（每个带 boardCount，含该作者隐藏板）
app.get('/api/admin/authors', { preHandler: requireAuth }, () => {
  return stmt.allAuthors.all().map((row) => ({
    ...rowToAuthor(row),
    boardCount: stmt.boardCountByAuthor.get(row.id).n,
  }))
})

// PUT /api/boards/:id -> 部分字段更新（updatedAt=今天），回最新 Board（含 isHidden）
app.put('/api/boards/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.boardById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'board not found' })
  const b = req.body ?? {}
  // 可更新字段：契约白名单 -> 列名 + 取值转换。
  const fields = [
    ['title', 'title', (v) => v],
    ['raidId', 'raid_id', (v) => v],
    ['bossId', 'boss_id', (v) => v ?? null],
    ['difficulty', 'difficulty', (v) => v],
    ['seasonVersion', 'season_version', (v) => v],
    ['contentText', 'content_text', (v) => v],
    ['description', 'description', (v) => v],
    ['authorId', 'author_id', (v) => v],
    ['isFeatured', 'is_featured', (v) => (v ? 1 : 0)],
    ['isHidden', 'is_hidden', (v) => (v ? 1 : 0)],
  ]
  const sets = []
  const params = []
  for (const [key, col, conv] of fields) {
    if (key in b) {
      sets.push(`${col} = ?`)
      params.push(conv(b[key]))
    }
  }
  const today = new Date().toISOString().slice(0, 10)
  sets.push('updated_at = ?')
  params.push(today)
  params.push(row.id)
  db.prepare(`UPDATE boards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  return rowToAdminBoard(stmt.boardById.get(row.id))
})

// DELETE /api/boards/:id -> { ok: true }
app.delete('/api/boards/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.boardById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'board not found' })
  stmt.deleteBoard.run(row.id)
  return { ok: true }
})

// POST /api/authors -> 后端生成 id(a-xxx) 的 Author
app.post('/api/authors', { preHandler: requireAuth }, (req, reply) => {
  const a = req.body ?? {}
  if (a.name == null || a.name === '') {
    return reply.code(400).send({ error: '字段缺失：name' })
  }
  const id = `a-${randomBytes(6).toString('hex')}`
  stmt.insertAuthor.run({
    id,
    name: a.name,
    avatarUrl: a.avatarUrl ?? null,
    bio: a.bio ?? null,
    guildName: a.guildName ?? null,
    guildRecruit: a.guildRecruit ?? null,
    guildContact: a.guildContact ?? null,
  })
  return reply.code(201).send(rowToAuthor(stmt.authorById.get(id)))
})

// PUT /api/authors/:id -> 部分字段更新，回最新 Author
app.put('/api/authors/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.authorById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'author not found' })
  const a = req.body ?? {}
  const fields = [
    ['name', 'name'],
    ['avatarUrl', 'avatar_url'],
    ['bio', 'bio'],
    ['guildName', 'guild_name'],
    ['guildRecruit', 'guild_recruit'],
    ['guildContact', 'guild_contact'],
  ]
  const sets = []
  const params = []
  for (const [key, col] of fields) {
    if (key in a) {
      sets.push(`${col} = ?`)
      params.push(a[key] ?? null)
    }
  }
  if (sets.length > 0) {
    params.push(row.id)
    db.prepare(`UPDATE authors SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  }
  return rowToAuthor(stmt.authorById.get(row.id))
})

// DELETE /api/authors/:id -> 名下仍有板则 409；否则 { ok: true }
app.delete('/api/authors/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.authorById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'author not found' })
  if (stmt.boardCountByAuthor.get(row.id).n > 0) {
    return reply.code(409).send({ error: '该作者名下还有战术板，不能删除' })
  }
  stmt.deleteAuthor.run(row.id)
  return { ok: true }
})

// ---------------------------------------------------------------------------
// 启动
// ---------------------------------------------------------------------------

try {
  await app.listen({ port: PORT, host: HOST })
  console.log(`PlanShare 已启动：http://${HOST}:${PORT}`)
} catch (err) {
  console.error('PlanShare 后端启动失败：', err)
  process.exit(1)
}
