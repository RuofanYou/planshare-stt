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
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import fastifyStatic from '@fastify/static'
import { raids, bosses, authors, boards } from './seed/seed-data.mjs'
import { ensureDatabasePath } from './db-path.mjs'
import {
  assertSafeAdminPassword,
  createViewDeduper,
  getClientKey,
  isOriginAllowed,
  parseAllowedOrigins,
} from './security.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = ensureDatabasePath({ envPath: process.env.DATABASE_PATH, serverDir: __dirname })
// 生产可经环境变量配置端口/绑定地址（容器/托管常用 0.0.0.0 + 平台注入 PORT）。
const PORT = Number(process.env.PORT) || 3001
const HOST = process.env.HOST || '127.0.0.1'
const CREATOR_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const TRUST_REVIEW = 'review'
const TRUST_TRUSTED = 'trusted'
const TRUST_PROMOTION_APPROVALS = 3
const ABUSE_PATTERNS = [
  /博彩/,
  /裸聊/,
  /约炮/,
  /黄暴/,
  /代练/,
  /开票/,
]
const REPORT_REASONS = new Set(['spam', 'abuse', 'wrong-info', 'copyright', 'other'])
const RESERVED_CREATOR_USERNAMES = new Set([
  'admin',
  'root',
  'api',
  'creator',
  'submit',
  'author',
  'authors',
  'board',
  'boards',
  'login',
  'register',
  'zhaobanzi',
])

// 管理员鉴权：单密码 + 内存有效 token 集合（重启即失效）。
const ADMIN_PASSWORD = assertSafeAdminPassword({
  password: process.env.ADMIN_PASSWORD,
  host: HOST,
  nodeEnv: process.env.NODE_ENV,
})
const validTokens = new Set()

// 安全边界：跨域只放行正式前端和本地开发；公开写接口与登录都做内存限流。
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.CORS_ORIGINS)
const viewDeduper = createViewDeduper({ windowMs: 10 * 60 * 1000 })

const sweepTimer = setInterval(() => {
  viewDeduper.sweep()
  stmt.deleteExpiredRateLimits.run(Date.now())
  stmt.deleteExpiredCreatorSessions.run(new Date().toISOString())
}, 5 * 60 * 1000)
sweepTimer.unref?.()

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
    guild_contact TEXT,
    creator_account_id TEXT,
    visibility    TEXT NOT NULL DEFAULT 'approved',
    moderation_status TEXT NOT NULL DEFAULT 'clean',
    updated_at    TEXT
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
    hidden_by      TEXT,
    is_featured    INTEGER NOT NULL DEFAULT 0,
    view_count     INTEGER NOT NULL DEFAULT 0,
    like_count     INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id                    TEXT PRIMARY KEY,
    title                 TEXT NOT NULL,
    raid_id               TEXT NOT NULL,
    boss_id               TEXT,
    difficulty            TEXT NOT NULL,
    season_version        TEXT NOT NULL,
    description           TEXT NOT NULL,
    content_text          TEXT NOT NULL,
    submitter_name        TEXT NOT NULL,
    contact               TEXT,
    wants_creator_profile INTEGER NOT NULL DEFAULT 0,
    creator_avatar_url    TEXT,
    creator_bio           TEXT,
    creator_guild_name    TEXT,
    creator_guild_recruit TEXT,
    creator_guild_contact TEXT,
    status                TEXT NOT NULL DEFAULT 'pending',
    source_key            TEXT,
    content_hash          TEXT,
    spam_reason           TEXT,
    review_note           TEXT,
    board_id              TEXT,
    author_id             TEXT,
    created_at            TEXT NOT NULL,
    reviewed_at           TEXT
  );

  CREATE TABLE IF NOT EXISTS creator_accounts (
    id                TEXT PRIMARY KEY,
    email             TEXT UNIQUE,
    username          TEXT UNIQUE,
    email_verified_at TEXT,
    password_hash     TEXT,
    status            TEXT NOT NULL,
    trust_level       TEXT NOT NULL DEFAULT 'trusted',
    approved_submission_count INTEGER NOT NULL DEFAULT 0,
    author_id         TEXT,
    contact           TEXT,
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    last_login_at     TEXT
  );

  CREATE TABLE IF NOT EXISTS creator_email_tokens (
    id                 TEXT PRIMARY KEY,
    creator_account_id TEXT NOT NULL,
    purpose            TEXT NOT NULL,
    token_hash         TEXT NOT NULL UNIQUE,
    expires_at         TEXT NOT NULL,
    consumed_at        TEXT,
    created_at         TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS creator_sessions (
    id                 TEXT PRIMARY KEY,
    creator_account_id TEXT NOT NULL,
    token_hash         TEXT NOT NULL UNIQUE,
    created_at         TEXT NOT NULL,
    expires_at         TEXT NOT NULL,
    last_seen_at       TEXT,
    revoked_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS rate_limits (
    key      TEXT PRIMARY KEY,
    count    INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,
    actor_type  TEXT NOT NULL,
    actor_id    TEXT,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   TEXT,
    detail      TEXT,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id              TEXT PRIMARY KEY,
    board_id        TEXT NOT NULL,
    board_title_snapshot TEXT,
    board_description_snapshot TEXT,
    board_content_snapshot TEXT,
    board_author_id_snapshot TEXT,
    board_updated_at_snapshot TEXT,
    reason          TEXT NOT NULL,
    detail          TEXT,
    source_key      TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    resolution_note TEXT,
    created_at      TEXT NOT NULL,
    reviewed_at     TEXT
  );
`)

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (columns.some((item) => item.name === column)) return
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
}

ensureColumn('authors', 'creator_account_id', 'creator_account_id TEXT')
ensureColumn('authors', 'visibility', "visibility TEXT NOT NULL DEFAULT 'approved'")
ensureColumn('authors', 'moderation_status', "moderation_status TEXT NOT NULL DEFAULT 'clean'")
ensureColumn('authors', 'updated_at', 'updated_at TEXT')
ensureColumn('creator_accounts', 'username', 'username TEXT')
ensureColumn('creator_accounts', 'contact', 'contact TEXT')
ensureColumn('creator_accounts', 'trust_level', "trust_level TEXT NOT NULL DEFAULT 'trusted'")
ensureColumn('creator_accounts', 'approved_submission_count', 'approved_submission_count INTEGER NOT NULL DEFAULT 0')
ensureColumn('submissions', 'content_hash', 'content_hash TEXT')
ensureColumn('submissions', 'spam_reason', 'spam_reason TEXT')
ensureColumn('boards', 'hidden_by', 'hidden_by TEXT')
ensureColumn('reports', 'board_title_snapshot', 'board_title_snapshot TEXT')
ensureColumn('reports', 'board_description_snapshot', 'board_description_snapshot TEXT')
ensureColumn('reports', 'board_content_snapshot', 'board_content_snapshot TEXT')
ensureColumn('reports', 'board_author_id_snapshot', 'board_author_id_snapshot TEXT')
ensureColumn('reports', 'board_updated_at_snapshot', 'board_updated_at_snapshot TEXT')
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_accounts_username_unique ON creator_accounts(username)')
db.exec('CREATE INDEX IF NOT EXISTS idx_creator_sessions_account_id ON creator_sessions(creator_account_id)')
db.exec('CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at)')
db.exec('CREATE INDEX IF NOT EXISTS idx_submissions_source_content ON submissions(source_key, content_hash)')
db.exec('CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at)')
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)')

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM boards').get().n
  if (count > 0) return

  const insertRaid = db.prepare('INSERT INTO raids (id, name, patch) VALUES (@id, @name, @patch)')
  const insertBoss = db.prepare(
    'INSERT INTO bosses (id, raid_id, name, "order") VALUES (@id, @raidId, @name, @order)'
  )
  const insertAuthor = db.prepare(`
    INSERT INTO authors (
      id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
      creator_account_id, visibility, moderation_status, updated_at
    )
    VALUES (
      @id, @name, @avatarUrl, @bio, @guildName, @guildRecruit, @guildContact,
      @creatorAccountId, @visibility, @moderationStatus, @updatedAt
    )
  `)
  const insertBoard = db.prepare(`
    INSERT INTO boards (
      id, title, raid_id, boss_id, difficulty, season_version, content_text,
      import_code, description, author_id, is_hidden, hidden_by, is_featured,
      view_count, like_count, created_at, updated_at
    ) VALUES (
      @id, @title, @raidId, @bossId, @difficulty, @seasonVersion, @contentText,
      @importCode, @description, @authorId, @isHidden, @hiddenBy, @isFeatured,
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
        creatorAccountId: null,
        visibility: 'approved',
        moderationStatus: 'clean',
        updatedAt: null,
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
        hiddenBy: b.hiddenBy ?? (b.isHidden ? 'admin' : null),
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
    creatorAccountId: row.creator_account_id ?? undefined,
    visibility: row.visibility ?? 'approved',
    moderationStatus: row.moderation_status ?? 'clean',
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
  return { ...rowToBoard(row), isHidden: row.is_hidden === 1, hiddenBy: row.hidden_by ?? null }
}

function rowToSubmission(row) {
  return {
    id: row.id,
    title: row.title,
    raidId: row.raid_id,
    bossId: row.boss_id ?? null,
    difficulty: row.difficulty,
    seasonVersion: row.season_version,
    description: row.description,
    contentText: row.content_text,
    submitterName: row.submitter_name,
    contact: row.contact ?? undefined,
    wantsCreatorProfile: row.wants_creator_profile === 1,
    creatorAvatarUrl: row.creator_avatar_url ?? undefined,
    creatorBio: row.creator_bio ?? undefined,
    creatorGuildName: row.creator_guild_name ?? undefined,
    creatorGuildRecruit: row.creator_guild_recruit ?? undefined,
    creatorGuildContact: row.creator_guild_contact ?? undefined,
    status: row.status,
    sourceKey: row.source_key ?? undefined,
    spamReason: row.spam_reason ?? undefined,
    reviewNote: row.review_note ?? undefined,
    boardId: row.board_id ?? undefined,
    authorId: row.author_id ?? undefined,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
  }
}

function rowToCreatorSubmission(row) {
  return {
    id: row.id,
    title: row.title,
    raidId: row.raid_id,
    bossId: row.boss_id ?? null,
    difficulty: row.difficulty,
    description: row.description,
    contentText: row.content_text,
    submitterName: row.submitter_name,
    status: row.status,
    reviewNote: row.review_note ?? undefined,
    spamReason: row.spam_reason ?? undefined,
    boardId: row.board_id ?? undefined,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
  }
}

function rowToCreatorAccount(row) {
  return {
    id: row.id,
    username: row.username,
    status: row.status,
    trustLevel: row.trust_level ?? TRUST_TRUSTED,
    approvedSubmissionCount: row.approved_submission_count ?? 0,
    authorId: row.author_id ?? undefined,
    contact: row.contact ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? undefined,
  }
}

function rowToReport(row) {
  return {
    id: row.id,
    boardId: row.board_id,
    boardTitle: row.board_title_snapshot ?? undefined,
    boardDescription: row.board_description_snapshot ?? undefined,
    boardContent: row.board_content_snapshot ?? undefined,
    boardAuthorId: row.board_author_id_snapshot ?? undefined,
    boardUpdatedAt: row.board_updated_at_snapshot ?? undefined,
    reason: row.reason,
    detail: row.detail ?? undefined,
    status: row.status,
    resolutionNote: row.resolution_note ?? undefined,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
  }
}

function rowToAuditLog(row) {
  return {
    id: row.id,
    actorType: row.actor_type,
    actorId: row.actor_id ?? undefined,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id ?? undefined,
    detail: row.detail ? JSON.parse(row.detail) : undefined,
    createdAt: row.created_at,
  }
}

function rowToCreatorAccountExport(row) {
  return {
    ...rowToCreatorAccount(row),
    email: row.email ?? undefined,
    emailVerifiedAt: row.email_verified_at ?? undefined,
    passwordHash: row.password_hash ?? undefined,
  }
}

function rowToAdminCreatorAccount(row) {
  const author = row.author_id ? stmt.authorById.get(row.author_id) : null
  return {
    ...rowToCreatorAccount(row),
    author: author
      ? {
          ...rowToAuthor(author),
          boardCount: stmt.boardCountByAuthor.get(author.id).n,
        }
      : null,
  }
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
  publicAuthors: db.prepare("SELECT * FROM authors WHERE visibility = 'approved'"),
  authorById: db.prepare('SELECT * FROM authors WHERE id = ?'),
  authorByCreatorAccountId: db.prepare('SELECT * FROM authors WHERE creator_account_id = ?'),
  boardById: db.prepare('SELECT * FROM boards WHERE id = ?'),
  creatorAccountById: db.prepare('SELECT * FROM creator_accounts WHERE id = ?'),
  creatorAccountByUsername: db.prepare('SELECT * FROM creator_accounts WHERE username = ?'),
  allCreatorAccounts: db.prepare('SELECT * FROM creator_accounts ORDER BY updated_at DESC'),
  insertCreatorAccount: db.prepare(`
    INSERT INTO creator_accounts (
      id, email, username, email_verified_at, password_hash, status, trust_level,
      approved_submission_count, author_id, contact,
      created_at, updated_at, last_login_at
    ) VALUES (
      @id, @email, @username, NULL, @passwordHash, @status, @trustLevel,
      @approvedSubmissionCount, @authorId, @contact,
      @createdAt, @updatedAt, NULL
    )
  `),
  updateCreatorLogin: db.prepare(`
    UPDATE creator_accounts
    SET updated_at = @updatedAt,
        last_login_at = @lastLoginAt
    WHERE id = @id
  `),
  updateCreatorAccountStatus: db.prepare(`
    UPDATE creator_accounts
    SET status = @status,
        updated_at = @updatedAt
    WHERE id = @id
  `),
  updateCreatorTrust: db.prepare(`
    UPDATE creator_accounts
    SET trust_level = @trustLevel,
        approved_submission_count = @approvedSubmissionCount,
        updated_at = @updatedAt
    WHERE id = @id
  `),
  updateCreatorAccountPassword: db.prepare(`
    UPDATE creator_accounts
    SET password_hash = @passwordHash,
        updated_at = @updatedAt
    WHERE id = @id
  `),
  creatorSessionByTokenHash: db.prepare(`
    SELECT * FROM creator_sessions
    WHERE token_hash = ?
      AND revoked_at IS NULL
      AND expires_at > ?
  `),
  insertCreatorSession: db.prepare(`
    INSERT INTO creator_sessions (
      id, creator_account_id, token_hash, created_at, expires_at, last_seen_at, revoked_at
    ) VALUES (
      @id, @creatorAccountId, @tokenHash, @createdAt, @expiresAt, @lastSeenAt, NULL
    )
  `),
  touchCreatorSession: db.prepare(`
    UPDATE creator_sessions
    SET last_seen_at = @lastSeenAt
    WHERE id = @id
  `),
  revokeCreatorSessionByTokenHash: db.prepare(`
    UPDATE creator_sessions
    SET revoked_at = @revokedAt
    WHERE token_hash = @tokenHash AND revoked_at IS NULL
  `),
  revokeCreatorSessionsByAccount: db.prepare(`
    UPDATE creator_sessions
    SET revoked_at = @revokedAt
    WHERE creator_account_id = @creatorAccountId AND revoked_at IS NULL
  `),
  revokeOtherCreatorSessionsByAccount: db.prepare(`
    UPDATE creator_sessions
    SET revoked_at = @revokedAt
    WHERE creator_account_id = @creatorAccountId
      AND token_hash != @tokenHash
      AND revoked_at IS NULL
  `),
  deleteExpiredCreatorSessions: db.prepare(`
    DELETE FROM creator_sessions
    WHERE expires_at <= ?
  `),
  updateCreatorAccountAuthor: db.prepare(`
    UPDATE creator_accounts
    SET author_id = @authorId,
        updated_at = @updatedAt
    WHERE id = @id
  `),
  upsertCreatorAccount: db.prepare(`
    INSERT INTO creator_accounts (
      id, email, username, email_verified_at, password_hash, status, trust_level,
      approved_submission_count, author_id, contact,
      created_at, updated_at, last_login_at
    ) VALUES (
      @id, @email, @username, @emailVerifiedAt, @passwordHash, @status, @trustLevel,
      @approvedSubmissionCount, @authorId, @contact,
      @createdAt, @updatedAt, @lastLoginAt
    )
    ON CONFLICT(id) DO UPDATE SET
      email = excluded.email,
      username = excluded.username,
      email_verified_at = excluded.email_verified_at,
      password_hash = excluded.password_hash,
      status = excluded.status,
      trust_level = excluded.trust_level,
      approved_submission_count = excluded.approved_submission_count,
      author_id = excluded.author_id,
      contact = excluded.contact,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      last_login_at = excluded.last_login_at
  `),
  bumpView: db.prepare('UPDATE boards SET view_count = view_count + 1 WHERE id = ?'),
  bumpLike: db.prepare('UPDATE boards SET like_count = like_count + 1 WHERE id = ?'),
  submissionById: db.prepare('SELECT * FROM submissions WHERE id = ?'),
  submissionsByAuthor: db.prepare(`
    SELECT * FROM submissions
    WHERE author_id = ?
    ORDER BY created_at DESC, id DESC
  `),
  allSubmissionsAdmin: db.prepare(`
    SELECT * FROM submissions
    ORDER BY
      CASE status
        WHEN 'pending' THEN 0
        WHEN 'approved' THEN 1
        WHEN 'rejected' THEN 2
        WHEN 'withdrawn' THEN 3
        ELSE 4
      END,
      created_at DESC
  `),
  insertSubmission: db.prepare(`
    INSERT INTO submissions (
      id, title, raid_id, boss_id, difficulty, season_version, description,
      content_text, submitter_name, contact, wants_creator_profile,
      creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit,
      creator_guild_contact, status, source_key, content_hash, spam_reason, author_id, created_at
    ) VALUES (
      @id, @title, @raidId, @bossId, @difficulty, @seasonVersion, @description,
      @contentText, @submitterName, @contact, @wantsCreatorProfile,
      @creatorAvatarUrl, @creatorBio, @creatorGuildName, @creatorGuildRecruit,
      @creatorGuildContact, @status, @sourceKey, @contentHash, @spamReason, @authorId, @createdAt
    )
  `),
  markSubmissionReviewed: db.prepare(`
    UPDATE submissions
    SET status = @status,
        review_note = @reviewNote,
        board_id = @boardId,
        author_id = @authorId,
        reviewed_at = @reviewedAt
    WHERE id = @id
  `),
  upsertSubmission: db.prepare(`
    INSERT INTO submissions (
      id, title, raid_id, boss_id, difficulty, season_version, description,
      content_text, submitter_name, contact, wants_creator_profile,
      creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit,
      creator_guild_contact, status, source_key, review_note, board_id, author_id,
      content_hash, spam_reason, created_at, reviewed_at
    ) VALUES (
      @id, @title, @raidId, @bossId, @difficulty, @seasonVersion, @description,
      @contentText, @submitterName, @contact, @wantsCreatorProfile,
      @creatorAvatarUrl, @creatorBio, @creatorGuildName, @creatorGuildRecruit,
      @creatorGuildContact, @status, @sourceKey, @reviewNote, @boardId, @authorId,
      @contentHash, @spamReason, @createdAt, @reviewedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      raid_id = excluded.raid_id,
      boss_id = excluded.boss_id,
      difficulty = excluded.difficulty,
      season_version = excluded.season_version,
      description = excluded.description,
      content_text = excluded.content_text,
      submitter_name = excluded.submitter_name,
      contact = excluded.contact,
      wants_creator_profile = excluded.wants_creator_profile,
      creator_avatar_url = excluded.creator_avatar_url,
      creator_bio = excluded.creator_bio,
      creator_guild_name = excluded.creator_guild_name,
      creator_guild_recruit = excluded.creator_guild_recruit,
      creator_guild_contact = excluded.creator_guild_contact,
      status = excluded.status,
      source_key = excluded.source_key,
      content_hash = excluded.content_hash,
      spam_reason = excluded.spam_reason,
      review_note = excluded.review_note,
      board_id = excluded.board_id,
      author_id = excluded.author_id,
      created_at = excluded.created_at,
      reviewed_at = excluded.reviewed_at
  `),
  // 管理端：全部板（含隐藏），按 updatedAt 倒序
  allBoardsAdmin: db.prepare('SELECT * FROM boards ORDER BY updated_at DESC'),
  boardsByAuthorAdmin: db.prepare('SELECT * FROM boards WHERE author_id = ? ORDER BY updated_at DESC'),
  // 某作者名下板数（含隐藏，用于删除前校验与作者列表统计）
  boardCountByAuthor: db.prepare('SELECT COUNT(*) AS n FROM boards WHERE author_id = ?'),
  deleteBoard: db.prepare('DELETE FROM boards WHERE id = ?'),
  upsertRaid: db.prepare(`
    INSERT INTO raids (id, name, patch)
    VALUES (@id, @name, @patch)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      patch = excluded.patch
  `),
  upsertBoss: db.prepare(`
    INSERT INTO bosses (id, raid_id, name, "order")
    VALUES (@id, @raidId, @name, @order)
    ON CONFLICT(id) DO UPDATE SET
      raid_id = excluded.raid_id,
      name = excluded.name,
      "order" = excluded."order"
  `),
  insertAuthor: db.prepare(`
    INSERT INTO authors (
      id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
      creator_account_id, visibility, moderation_status, updated_at
    )
    VALUES (
      @id, @name, @avatarUrl, @bio, @guildName, @guildRecruit, @guildContact,
      @creatorAccountId, @visibility, @moderationStatus, @updatedAt
    )
  `),
  upsertAuthor: db.prepare(`
    INSERT INTO authors (
      id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
      creator_account_id, visibility, moderation_status, updated_at
    )
    VALUES (
      @id, @name, @avatarUrl, @bio, @guildName, @guildRecruit, @guildContact,
      @creatorAccountId, @visibility, @moderationStatus, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      avatar_url = excluded.avatar_url,
      bio = excluded.bio,
      guild_name = excluded.guild_name,
      guild_recruit = excluded.guild_recruit,
      guild_contact = excluded.guild_contact,
      creator_account_id = COALESCE(excluded.creator_account_id, authors.creator_account_id),
      visibility = COALESCE(excluded.visibility, authors.visibility),
      moderation_status = COALESCE(excluded.moderation_status, authors.moderation_status),
      updated_at = COALESCE(excluded.updated_at, authors.updated_at)
  `),
  updateAuthorCreatorState: db.prepare(`
    UPDATE authors
    SET creator_account_id = COALESCE(@creatorAccountId, creator_account_id),
        visibility = @visibility,
        moderation_status = @moderationStatus,
        updated_at = @updatedAt
    WHERE id = @id
  `),
  updateAuthorProfile: db.prepare(`
    UPDATE authors
    SET name = @name,
        avatar_url = @avatarUrl,
        bio = @bio,
        guild_name = @guildName,
        guild_recruit = @guildRecruit,
        guild_contact = @guildContact,
        visibility = @visibility,
        moderation_status = @moderationStatus,
        updated_at = @updatedAt
    WHERE id = @id
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
  upsertBoard: db.prepare(`
    INSERT INTO boards (
      id, title, raid_id, boss_id, difficulty, season_version, content_text,
      import_code, description, author_id, is_hidden, hidden_by, is_featured,
      view_count, like_count, created_at, updated_at
    ) VALUES (
      @id, @title, @raidId, @bossId, @difficulty, @seasonVersion, @contentText,
      @importCode, @description, @authorId, @isHidden, @hiddenBy, @isFeatured,
      @viewCount, @likeCount, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      raid_id = excluded.raid_id,
      boss_id = excluded.boss_id,
      difficulty = excluded.difficulty,
      season_version = excluded.season_version,
      content_text = excluded.content_text,
      import_code = excluded.import_code,
      description = excluded.description,
      author_id = excluded.author_id,
      is_hidden = excluded.is_hidden,
      hidden_by = excluded.hidden_by,
      is_featured = excluded.is_featured,
      view_count = excluded.view_count,
      like_count = excluded.like_count,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `),
  rateLimitByKey: db.prepare('SELECT * FROM rate_limits WHERE key = ?'),
  upsertRateLimit: db.prepare(`
    INSERT INTO rate_limits (key, count, reset_at)
    VALUES (@key, @count, @resetAt)
    ON CONFLICT(key) DO UPDATE SET
      count = excluded.count,
      reset_at = excluded.reset_at
  `),
  deleteRateLimit: db.prepare('DELETE FROM rate_limits WHERE key = ?'),
  deleteExpiredRateLimits: db.prepare('DELETE FROM rate_limits WHERE reset_at <= ?'),
  duplicateSubmissionBySourceContent: db.prepare(`
    SELECT id FROM submissions
    WHERE source_key = ? AND content_hash = ?
    LIMIT 1
  `),
  insertAuditLog: db.prepare(`
    INSERT INTO audit_logs (
      id, actor_type, actor_id, action, entity_type, entity_id, detail, created_at
    ) VALUES (
      @id, @actorType, @actorId, @action, @entityType, @entityId, @detail, @createdAt
    )
  `),
  auditLogsAdmin: db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200'),
  insertReport: db.prepare(`
    INSERT INTO reports (
      id, board_id, board_title_snapshot, board_description_snapshot,
      board_content_snapshot, board_author_id_snapshot, board_updated_at_snapshot,
      reason, detail, source_key, status, created_at
    ) VALUES (
      @id, @boardId, @boardTitle, @boardDescription,
      @boardContent, @boardAuthorId, @boardUpdatedAt,
      @reason, @detail, @sourceKey, 'pending', @createdAt
    )
  `),
  allReportsAdmin: db.prepare(`
    SELECT * FROM reports
    ORDER BY
      CASE status WHEN 'pending' THEN 0 ELSE 1 END,
      created_at DESC
  `),
  reportById: db.prepare('SELECT * FROM reports WHERE id = ?'),
  updateReportStatus: db.prepare(`
    UPDATE reports
    SET status = @status,
        resolution_note = @resolutionNote,
        reviewed_at = @reviewedAt
    WHERE id = @id
  `),
  boardCountByBoss: db.prepare('SELECT COUNT(*) AS n FROM boards WHERE boss_id = ?'),
  submissionCountByBoss: db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE boss_id = ?'),
  boardCountByRaidAny: db.prepare('SELECT COUNT(*) AS n FROM boards WHERE raid_id = ?'),
  submissionCountByRaid: db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE raid_id = ?'),
  bossCountByRaid: db.prepare('SELECT COUNT(*) AS n FROM bosses WHERE raid_id = ?'),
  deleteRaid: db.prepare('DELETE FROM raids WHERE id = ?'),
  deleteBoss: db.prepare('DELETE FROM bosses WHERE id = ?'),
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

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value) {
  const text = cleanText(value)
  return text || null
}

function hashText(value) {
  return createHash('sha256').update(String(value ?? '')).digest('hex')
}

function normalizeAbuseText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, '')
}

function findAbuseReason(...values) {
  const normalized = normalizeAbuseText(values.filter(Boolean).join('\n'))
  if (!normalized) return ''
  return ABUSE_PATTERNS.some((pattern) => pattern.test(normalized)) ? 'content_blacklist' : ''
}

function hitPersistentRateLimit(key, { limit, windowMs }) {
  const now = Date.now()
  const current = stmt.rateLimitByKey.get(key)
  if (!current || current.reset_at <= now) {
    const resetAt = now + windowMs
    stmt.upsertRateLimit.run({ key, count: 1, resetAt })
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt }
  }
  const count = current.count + 1
  stmt.upsertRateLimit.run({ key, count, resetAt: current.reset_at })
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: current.reset_at,
  }
}

function resetPersistentRateLimit(key) {
  stmt.deleteRateLimit.run(key)
}

function rateLimitReply(reply, limit, message = '操作太频繁，请稍后再试') {
  reply.header('Retry-After', String(Math.ceil((limit.resetAt - Date.now()) / 1000)))
  return reply.code(429).send({ error: message })
}

function auditLog({ actorType, actorId = null, action, entityType, entityId = null, detail = null }) {
  stmt.insertAuditLog.run({
    id: `al-${randomBytes(8).toString('hex')}`,
    actorType,
    actorId,
    action,
    entityType,
    entityId,
    detail: detail == null ? null : JSON.stringify(detail),
    createdAt: new Date().toISOString(),
  })
}

function timingSafeStringEqual(a, b) {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf)
}

function normalizeUsername(value) {
  return cleanText(value).toLowerCase()
}

function validateCreatorUsername(username) {
  if (!username) return '请填写用户名'
  if (username.length < 3 || username.length > 24) return '用户名长度需要 3-24 位'
  if (!/^[a-z0-9_-]+$/.test(username)) return '用户名只能包含小写英文、数字、下划线或短横线'
  if (RESERVED_CREATOR_USERNAMES.has(username)) return '这个用户名不能使用'
  return ''
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `scrypt:${salt}:${hash}`
}

function verifyPassword(password, stored) {
  const [kind, salt, expected] = String(stored || '').split(':')
  if (kind !== 'scrypt' || !salt || !expected) return false
  const actual = scryptSync(password, salt, 64).toString('hex')
  return timingSafeStringEqual(actual, expected)
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function createCreatorAccountSession(accountId) {
  const token = randomBytes(32).toString('hex')
  const now = new Date()
  const nowIso = now.toISOString()
  stmt.insertCreatorSession.run({
    id: `cs-${randomBytes(8).toString('hex')}`,
    creatorAccountId: accountId,
    tokenHash: hashSessionToken(token),
    createdAt: nowIso,
    expiresAt: new Date(now.getTime() + CREATOR_SESSION_TTL_MS).toISOString(),
    lastSeenAt: nowIso,
  })
  return token
}

function createCreatorApplication(input, now) {
  const username = normalizeUsername(input.creatorUsername)
  if (stmt.creatorAccountByUsername.get(username)) {
    const err = new Error('这个用户名已被占用')
    err.statusCode = 409
    throw err
  }

  const accountId = `ca-${randomBytes(8).toString('hex')}`
  const authorId = `a-${randomBytes(6).toString('hex')}`
  stmt.insertCreatorAccount.run({
    id: accountId,
    email: `${accountId}@creator.local`,
    username,
    passwordHash: hashPassword(input.creatorPassword),
    status: 'active',
    trustLevel: TRUST_REVIEW,
    approvedSubmissionCount: 0,
    authorId: null,
    contact: input.contact ?? null,
    createdAt: now,
    updatedAt: now,
  })
  stmt.insertAuthor.run({
    id: authorId,
    name: input.submitterName,
    avatarUrl: input.creatorAvatarUrl ?? null,
    bio: input.creatorBio ?? null,
    guildName: input.creatorGuildName ?? null,
    guildRecruit: input.creatorGuildRecruit ?? null,
    guildContact: input.creatorGuildContact ?? null,
    creatorAccountId: accountId,
    visibility: 'semi_public',
    moderationStatus: 'clean',
    updatedAt: now,
  })
  stmt.updateCreatorAccountAuthor.run({ id: accountId, authorId, updatedAt: now })
  const account = stmt.creatorAccountById.get(accountId)
  const author = stmt.authorById.get(authorId)
  return {
    account,
    author,
    creatorAuth: {
      token: createCreatorAccountSession(account.id),
      user: rowToCreatorAccount(account),
      author: rowToAuthor(author),
    },
  }
}

function readSubmissionInput(body) {
  return {
    title: cleanText(body.title),
    raidId: cleanText(body.raidId),
    bossId: optionalText(body.bossId),
    difficulty: cleanText(body.difficulty),
    seasonVersion: cleanText(body.seasonVersion),
    description: cleanText(body.description),
    contentText: typeof body.contentText === 'string' ? body.contentText.trim() : '',
    submitterName: cleanText(body.submitterName),
    contact: optionalText(body.contact),
    wantsCreatorProfile: body.wantsCreatorProfile === true,
    creatorUsername: normalizeUsername(body.creatorUsername),
    creatorPassword: typeof body.creatorPassword === 'string' ? body.creatorPassword : '',
    creatorAvatarUrl: optionalText(body.creatorAvatarUrl ?? body.avatarUrl),
    creatorBio: optionalText(body.creatorBio ?? body.bio),
    creatorGuildName: optionalText(body.creatorGuildName ?? body.guildName),
    creatorGuildRecruit: optionalText(body.creatorGuildRecruit ?? body.guildRecruit),
    creatorGuildContact: optionalText(body.creatorGuildContact ?? body.guildContact),
    website: cleanText(body.website),
  }
}

function validateSubmissionInput(input, reply, options = {}) {
  const required = [
    ['title', '标题'],
    ['raidId', '团本'],
    ['bossId', 'BOSS'],
    ['difficulty', '难度'],
    ['contentText', '战术正文'],
    ['submitterName', '投稿署名'],
  ]
  for (const [key, label] of required) {
    if (!input[key]) return reply.code(400).send({ error: `字段缺失：${key}（${label}）` })
  }
  if (!['heroic', 'mythic'].includes(input.difficulty)) {
    return reply.code(400).send({ error: '字段无效：difficulty' })
  }
  if (!stmt.raidById.get(input.raidId)) {
    return reply.code(400).send({ error: '字段无效：raidId' })
  }
  input.seasonVersion = input.seasonVersion || stmt.raidById.get(input.raidId).patch
  if (input.bossId && !stmt.bossById.get(input.bossId)) {
    return reply.code(400).send({ error: '字段无效：bossId' })
  }
  if (input.wantsCreatorProfile && !options.hasCreatorSession) {
    const usernameError = validateCreatorUsername(input.creatorUsername)
    if (usernameError) return reply.code(400).send({ error: usernameError })
    if (!input.creatorPassword) return reply.code(400).send({ error: '请填写密码' })
    if (input.creatorPassword.length < 8) {
      return reply.code(400).send({ error: '密码至少需要 8 位' })
    }
  }
  return null
}

function readCreatorProfilePatch(body = {}, current) {
  const next = {
    name: optionalText(body.name) ?? current.name,
    avatarUrl: optionalText(body.avatarUrl) ?? current.avatar_url,
    bio: optionalText(body.bio) ?? current.bio,
    guildName: optionalText(body.guildName) ?? current.guild_name,
    guildRecruit: optionalText(body.guildRecruit) ?? current.guild_recruit,
    guildContact: optionalText(body.guildContact) ?? current.guild_contact,
  }
  const limits = [
    ['name', next.name, 40],
    ['avatarUrl', next.avatarUrl, 240],
    ['bio', next.bio, 120],
    ['guildName', next.guildName, 40],
    ['guildRecruit', next.guildRecruit, 120],
    ['guildContact', next.guildContact, 80],
  ]
  for (const [key, value, max] of limits) {
    if (value && value.length > max) throw new Error(`字段过长：${key}`)
  }
  if (findAbuseReason(...limits.map(([, value]) => value || ''))) {
    throw new Error('作者资料包含暂不支持公开展示的内容')
  }
  return next
}

function readBoardDraft(body = {}, current = null) {
  return {
    title: 'title' in body ? cleanText(body.title) : (current?.title ?? ''),
    raidId: 'raidId' in body ? cleanText(body.raidId) : (current?.raid_id ?? ''),
    bossId: 'bossId' in body ? optionalText(body.bossId) : (current?.boss_id ?? null),
    difficulty: 'difficulty' in body ? cleanText(body.difficulty) : (current?.difficulty ?? ''),
    seasonVersion: 'seasonVersion' in body
      ? cleanText(body.seasonVersion)
      : (current?.season_version ?? ''),
    description: 'description' in body
      ? cleanText(body.description)
      : (current?.description ?? ''),
    contentText: 'contentText' in body
      ? (typeof body.contentText === 'string' ? body.contentText.trim() : '')
      : (current?.content_text ?? ''),
    isHidden: 'isHidden' in body ? body.isHidden === true : current?.is_hidden === 1,
  }
}

function validateBoardDraft(input, reply) {
  const required = [
    ['title', '标题'],
    ['raidId', '团本'],
    ['bossId', 'BOSS'],
    ['difficulty', '难度'],
    ['contentText', '战术正文'],
  ]
  for (const [key, label] of required) {
    if (!input[key]) return reply.code(400).send({ error: `字段缺失：${key}（${label}）` })
  }
  if (!['heroic', 'mythic'].includes(input.difficulty)) {
    return reply.code(400).send({ error: '字段无效：difficulty' })
  }
  const raid = stmt.raidById.get(input.raidId)
  if (!raid) return reply.code(400).send({ error: '字段无效：raidId' })
  if (input.bossId && !stmt.bossById.get(input.bossId)) {
    return reply.code(400).send({ error: '字段无效：bossId' })
  }
  input.seasonVersion = input.seasonVersion || raid.patch
  return null
}

function getApprovedCreatorAuthor(account, reply) {
  if (!account || account.status !== 'active') {
    reply.code(403).send({ error: '账号已被暂停，请联系管理员' })
    return null
  }
  const author = account.author_id ? stmt.authorById.get(account.author_id) : null
  if (!author || author.visibility === 'hidden') {
    reply.code(404).send({ error: '作者主页不存在' })
    return null
  }
  if (author.visibility !== 'approved') {
    reply.code(403).send({ error: '作者主页通过审核后才能直接发布战术板' })
    return null
  }
  if ((account.trust_level ?? TRUST_TRUSTED) !== TRUST_TRUSTED) {
    reply.code(403).send({ error: '完成 3 次审核通过后才能直接发布战术板' })
    return null
  }
  return author
}

function promoteCreatorAuthor(authorRow) {
  if (!authorRow?.creator_account_id || authorRow.visibility === 'approved') {
    return authorRow
  }
  stmt.updateAuthorCreatorState.run({
    id: authorRow.id,
    creatorAccountId: authorRow.creator_account_id,
    visibility: 'approved',
    moderationStatus: authorRow.moderation_status ?? 'clean',
    updatedAt: new Date().toISOString(),
  })
  return stmt.authorById.get(authorRow.id)
}

function recordCreatorSubmissionApproval(authorRow) {
  if (!authorRow?.creator_account_id) return null
  const account = stmt.creatorAccountById.get(authorRow.creator_account_id)
  if (!account) return null
  const nextCount = (account.approved_submission_count ?? 0) + 1
  const trustLevel = nextCount >= TRUST_PROMOTION_APPROVALS ? TRUST_TRUSTED : (account.trust_level ?? TRUST_REVIEW)
  stmt.updateCreatorTrust.run({
    id: account.id,
    trustLevel,
    approvedSubmissionCount: nextCount,
    updatedAt: new Date().toISOString(),
  })
  return stmt.creatorAccountById.get(account.id)
}

function resetCreatorSubmissionProgress(authorId) {
  if (!authorId) return
  const author = stmt.authorById.get(authorId)
  if (!author?.creator_account_id) return
  const account = stmt.creatorAccountById.get(author.creator_account_id)
  if (!account || (account.trust_level ?? TRUST_TRUSTED) === TRUST_TRUSTED) return
  stmt.updateCreatorTrust.run({
    id: account.id,
    trustLevel: TRUST_REVIEW,
    approvedSubmissionCount: 0,
    updatedAt: new Date().toISOString(),
  })
}

function createAuthorFromSubmission(submission, mode, body = {}) {
  const name = cleanText(body.authorName) || submission.submitter_name
  const useProfile = mode === 'createAuthor'
  const linkedAuthor = submission.author_id ? stmt.authorById.get(submission.author_id) : null
  if (linkedAuthor?.creator_account_id) {
    const now = new Date().toISOString()
    const profile = readCreatorProfilePatch(
      {
        name,
        avatarUrl: useProfile ? (optionalText(body.avatarUrl) ?? submission.creator_avatar_url) : linkedAuthor.avatar_url,
        bio: useProfile ? (optionalText(body.bio) ?? submission.creator_bio) : linkedAuthor.bio,
        guildName: useProfile ? (optionalText(body.guildName) ?? submission.creator_guild_name) : linkedAuthor.guild_name,
        guildRecruit: useProfile ? (optionalText(body.guildRecruit) ?? submission.creator_guild_recruit) : linkedAuthor.guild_recruit,
        guildContact: useProfile ? (optionalText(body.guildContact) ?? submission.creator_guild_contact) : linkedAuthor.guild_contact,
      },
      linkedAuthor
    )
    stmt.updateAuthorProfile.run({
      id: linkedAuthor.id,
      ...profile,
      visibility: 'approved',
      moderationStatus: linkedAuthor.moderation_status ?? 'clean',
      updatedAt: now,
    })
    return stmt.authorById.get(linkedAuthor.id)
  }
  const id = `a-${randomBytes(6).toString('hex')}`
  stmt.insertAuthor.run({
    id,
    name,
    avatarUrl: useProfile ? (optionalText(body.avatarUrl) ?? submission.creator_avatar_url) : null,
    bio: useProfile ? (optionalText(body.bio) ?? submission.creator_bio) : null,
    guildName: useProfile ? (optionalText(body.guildName) ?? submission.creator_guild_name) : null,
    guildRecruit: useProfile ? (optionalText(body.guildRecruit) ?? submission.creator_guild_recruit) : null,
    guildContact: useProfile ? (optionalText(body.guildContact) ?? submission.creator_guild_contact) : null,
    creatorAccountId: null,
    visibility: 'approved',
    moderationStatus: 'clean',
    updatedAt: new Date().toISOString(),
  })
  return stmt.authorById.get(id)
}

function publishSubmission(submission, authorId, body = {}) {
  const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const today = new Date().toISOString().slice(0, 10)
  stmt.insertBoard.run({
    id,
    title: submission.title,
    raidId: submission.raid_id,
    bossId: submission.boss_id ?? null,
    difficulty: submission.difficulty,
    seasonVersion: submission.season_version,
    contentText: submission.content_text,
    description: submission.description,
    authorId,
    isFeatured: body.isFeatured ? 1 : 0,
    createdAt: today,
    updatedAt: today,
  })
  return stmt.boardById.get(id)
}

// ---------------------------------------------------------------------------
// Fastify 路由
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })
await app.register(cors, {
  origin(origin, cb) {
    cb(null, isOriginAllowed(origin, ALLOWED_ORIGINS))
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
})

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

function requireCreatorAuth(req, reply, done) {
  const account = getCreatorAccountFromRequest(req)
  if (!account) {
    reply.code(401).send({ error: '未授权' })
    return
  }
  req.creatorAccount = account
  done()
}

function getCreatorAccountFromRequest(req) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const now = new Date().toISOString()
  const session = stmt.creatorSessionByTokenHash.get(hashSessionToken(token), now)
  if (!session) return null
  const account = stmt.creatorAccountById.get(session.creator_account_id)
  if (!account) return null
  stmt.touchCreatorSession.run({ id: session.id, lastSeenAt: now })
  return account
}

// POST /api/admin/login -> { token }；密码错 401。
app.post('/api/admin/login', (req, reply) => {
  const clientKey = getClientKey(req)
  const limit = hitPersistentRateLimit(`login:${clientKey}`, { limit: 5, windowMs: 15 * 60 * 1000 })
  if (!limit.allowed) {
    return rateLimitReply(reply, limit, '登录尝试太频繁，请稍后再试')
  }

  const { password } = req.body ?? {}
  if (password !== ADMIN_PASSWORD) {
    return reply.code(401).send({ error: '密码错误' })
  }
  resetPersistentRateLimit(`login:${clientKey}`)
  const token = randomBytes(24).toString('hex')
  validTokens.add(token)
  return { token }
})

// POST /api/creator/login -> 用户名 + 密码登录。
app.post('/api/creator/login', (req, reply) => {
  const clientKey = getClientKey(req)
  const limit = hitPersistentRateLimit(`creator-login:${clientKey}`, { limit: 5, windowMs: 15 * 60 * 1000 })
  if (!limit.allowed) {
    return rateLimitReply(reply, limit)
  }

  const username = normalizeUsername(req.body?.username)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  const account = username ? stmt.creatorAccountByUsername.get(username) : null
  if (account?.status === 'suspended') {
    return reply.code(403).send({ error: '账号已被暂停，请联系管理员' })
  }
  if (!account || account.status !== 'active' || !verifyPassword(password, account.password_hash)) {
    return reply.code(401).send({ error: '用户名或密码错误' })
  }

  resetPersistentRateLimit(`creator-login:${clientKey}`)
  const now = new Date().toISOString()
  stmt.updateCreatorLogin.run({
    id: account.id,
    updatedAt: now,
    lastLoginAt: now,
  })
  const fresh = stmt.creatorAccountById.get(account.id)
  const author = fresh.author_id ? stmt.authorById.get(fresh.author_id) : null
  return {
    token: createCreatorAccountSession(fresh.id),
    user: rowToCreatorAccount(fresh),
    author: author ? rowToAuthor(author) : null,
  }
})

// GET /api/creator/me -> 当前创作者登录态。
app.get('/api/creator/me', { preHandler: requireCreatorAuth }, (req) => {
  const user = rowToCreatorAccount(req.creatorAccount)
  const authorRow = req.creatorAccount.author_id ? stmt.authorById.get(req.creatorAccount.author_id) : null
  return {
    user,
    author: authorRow ? rowToAuthor(authorRow) : null,
  }
})

// GET /api/creator/submissions -> 当前创作者自己的投稿审核进度。
app.get('/api/creator/submissions', { preHandler: requireCreatorAuth }, (req) => {
  const authorId = req.creatorAccount.author_id
  if (!authorId) return []
  return stmt.submissionsByAuthor.all(authorId).map(rowToCreatorSubmission)
})

// POST /api/creator/submissions/:id/withdraw -> 创作者撤回自己的待审投稿。
app.post('/api/creator/submissions/:id/withdraw', { preHandler: requireCreatorAuth }, (req, reply) => {
  const authorId = req.creatorAccount.author_id
  const submission = stmt.submissionById.get(req.params.id)
  if (!authorId || !submission || submission.author_id !== authorId) {
    return reply.code(404).send({ error: 'submission not found' })
  }
  if (submission.status !== 'pending') {
    return reply.code(409).send({ error: '只有待审投稿可以撤回' })
  }
  const reviewedAt = new Date().toISOString()
  stmt.markSubmissionReviewed.run({
    id: submission.id,
    status: 'withdrawn',
    reviewNote: null,
    boardId: null,
    authorId: submission.author_id,
    reviewedAt,
  })
  auditLog({
    actorType: 'creator',
    actorId: req.creatorAccount.id,
    action: 'creator_submission_withdraw',
    entityType: 'submission',
    entityId: submission.id,
  })
  return rowToCreatorSubmission(stmt.submissionById.get(submission.id))
})

// PUT /api/creator/password -> 创作者自助修改密码，保留当前会话并撤销其他会话。
app.put('/api/creator/password', { preHandler: requireCreatorAuth }, (req, reply) => {
  if (req.creatorAccount.status !== 'active') {
    return reply.code(403).send({ error: '账号已被暂停，请联系管理员' })
  }
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const nextPassword = typeof req.body?.nextPassword === 'string' ? req.body.nextPassword : ''
  if (!verifyPassword(currentPassword, req.creatorAccount.password_hash)) {
    return reply.code(400).send({ error: '当前密码不正确' })
  }
  if (nextPassword.length < 8) {
    return reply.code(400).send({ error: '密码长度至少 8 位' })
  }
  if (verifyPassword(nextPassword, req.creatorAccount.password_hash)) {
    return reply.code(400).send({ error: '新密码不能和当前密码相同' })
  }

  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  const now = new Date().toISOString()
  stmt.updateCreatorAccountPassword.run({
    id: req.creatorAccount.id,
    passwordHash: hashPassword(nextPassword),
    updatedAt: now,
  })
  stmt.revokeOtherCreatorSessionsByAccount.run({
    creatorAccountId: req.creatorAccount.id,
    tokenHash: hashSessionToken(token),
    revokedAt: now,
  })
  auditLog({
    actorType: 'creator',
    actorId: req.creatorAccount.id,
    action: 'creator_password_update',
    entityType: 'creator_account',
    entityId: req.creatorAccount.id,
  })
  return {
    ok: true,
    revokedOtherSessions: true,
  }
})

// PUT /api/creator/profile -> 创作者编辑自己的半公开作者资料。
app.put('/api/creator/profile', { preHandler: requireCreatorAuth }, (req, reply) => {
  if (!req.creatorAccount) {
    return reply.code(403).send({ error: '当前创作者身份不可用' })
  }
  if (req.creatorAccount.status !== 'active') {
    return reply.code(403).send({ error: '账号已被暂停，请联系管理员' })
  }
  const author = req.creatorAccount.author_id ? stmt.authorById.get(req.creatorAccount.author_id) : null
  if (!author || author.visibility === 'hidden') {
    return reply.code(404).send({ error: '作者主页不存在' })
  }

  let profile
  try {
    profile = readCreatorProfilePatch(req.body ?? {}, author)
  } catch (err) {
    return reply.code(400).send({ error: err instanceof Error ? err.message : '作者资料无效' })
  }

  const nextVisibility = author.visibility === 'draft' ? 'semi_public' : author.visibility
  stmt.updateAuthorProfile.run({
    id: author.id,
    ...profile,
    visibility: nextVisibility,
    moderationStatus: author.moderation_status ?? 'clean',
    updatedAt: new Date().toISOString(),
  })
  return {
    user: rowToCreatorAccount(stmt.creatorAccountById.get(req.creatorAccount.id)),
    author: rowToAuthor(stmt.authorById.get(author.id)),
  }
})

// POST /api/creator/logout -> 撤销当前创作者 session。
app.post('/api/creator/logout', (req) => {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (token) {
    stmt.revokeCreatorSessionByTokenHash.run({
      tokenHash: hashSessionToken(token),
      revokedAt: new Date().toISOString(),
    })
  }
  return { ok: true }
})

// GET /api/creator/boards -> 当前正式创作者自己的板（含已下架）
app.get('/api/creator/boards', { preHandler: requireCreatorAuth }, (req, reply) => {
  const author = getApprovedCreatorAuthor(req.creatorAccount, reply)
  if (!author) return reply
  return stmt.boardsByAuthorAdmin.all(author.id).map(rowToAdminBoard)
})

// POST /api/creator/boards -> 正式创作者直接发布自己的板，不进入审核队列。
app.post('/api/creator/boards', { preHandler: requireCreatorAuth }, (req, reply) => {
  const author = getApprovedCreatorAuthor(req.creatorAccount, reply)
  if (!author) return reply

  const clientKey = getClientKey(req)
  const limit = hitPersistentRateLimit(`creator-board:${req.creatorAccount.id}:${clientKey}`, {
    limit: 10,
    windowMs: 60 * 60 * 1000,
  })
  if (!limit.allowed) {
    return rateLimitReply(reply, limit)
  }

  const input = readBoardDraft(req.body ?? {})
  const errorReply = validateBoardDraft(input, reply)
  if (errorReply) return errorReply

  const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  const today = new Date().toISOString().slice(0, 10)
  stmt.insertBoard.run({
    id,
    title: input.title,
    raidId: input.raidId,
    bossId: input.bossId ?? null,
    difficulty: input.difficulty,
    seasonVersion: input.seasonVersion,
    contentText: input.contentText,
    description: input.description,
    authorId: author.id,
    isFeatured: 0,
    createdAt: today,
    updatedAt: today,
  })
  auditLog({
    actorType: 'creator',
    actorId: req.creatorAccount.id,
    action: 'creator_board_publish',
    entityType: 'board',
    entityId: id,
  })
  return reply.code(201).send(rowToAdminBoard(stmt.boardById.get(id)))
})

// PUT /api/creator/boards/:id -> 正式创作者编辑/恢复自己的板。
app.put('/api/creator/boards/:id', { preHandler: requireCreatorAuth }, (req, reply) => {
  const author = getApprovedCreatorAuthor(req.creatorAccount, reply)
  if (!author) return reply
  const row = stmt.boardById.get(req.params.id)
  if (!row || row.author_id !== author.id) return reply.code(404).send({ error: 'board not found' })

  const input = readBoardDraft(req.body ?? {}, row)
  const errorReply = validateBoardDraft(input, reply)
  if (errorReply) return errorReply
  const body = req.body ?? {}
  if (body.isHidden === false && row.hidden_by === 'admin') {
    return reply.code(403).send({ error: '该战术板已被管理员隐藏，不能自行恢复' })
  }

  const fields = [
    ['title', 'title', input.title],
    ['raidId', 'raid_id', input.raidId],
    ['bossId', 'boss_id', input.bossId ?? null],
    ['difficulty', 'difficulty', input.difficulty],
    ['seasonVersion', 'season_version', input.seasonVersion],
    ['contentText', 'content_text', input.contentText],
    ['description', 'description', input.description],
  ]
  const sets = []
  const params = []
  for (const [key, col, value] of fields) {
    if (key in body) {
      sets.push(`${col} = ?`)
      params.push(value)
    }
  }
  if ('isHidden' in body) {
    sets.push('is_hidden = ?')
    params.push(input.isHidden ? 1 : 0)
    sets.push('hidden_by = ?')
    params.push(input.isHidden ? 'creator' : null)
  }
  const today = new Date().toISOString().slice(0, 10)
  sets.push('updated_at = ?')
  params.push(today, row.id)
  db.prepare(`UPDATE boards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  auditLog({
    actorType: 'creator',
    actorId: req.creatorAccount.id,
    action: 'creator_board_update',
    entityType: 'board',
    entityId: row.id,
    detail: { fields: Object.keys(body).filter((key) => key !== 'isFeatured') },
  })
  return rowToAdminBoard(stmt.boardById.get(row.id))
})

// DELETE /api/creator/boards/:id -> 创作者自助下架；保留数据，支持恢复发布。
app.delete('/api/creator/boards/:id', { preHandler: requireCreatorAuth }, (req, reply) => {
  const author = getApprovedCreatorAuthor(req.creatorAccount, reply)
  if (!author) return reply
  const row = stmt.boardById.get(req.params.id)
  if (!row || row.author_id !== author.id) return reply.code(404).send({ error: 'board not found' })

  db.prepare("UPDATE boards SET is_hidden = 1, hidden_by = 'creator', updated_at = ? WHERE id = ?")
    .run(new Date().toISOString().slice(0, 10), row.id)
  auditLog({
    actorType: 'creator',
    actorId: req.creatorAccount.id,
    action: 'creator_board_hide',
    entityType: 'board',
    entityId: row.id,
  })
  return { ok: true }
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
  if (viewDeduper.shouldCount(getClientKey(req), row.id)) {
    stmt.bumpView.run(row.id)
  }
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
  return stmt.publicAuthors.all().map(rowToAuthor)
})

// GET /api/authors/:id -> { author, boards }
app.get('/api/authors/:id', (req, reply) => {
  const row = stmt.authorById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'author not found' })
  if (!['semi_public', 'approved'].includes(row.visibility ?? 'approved')) {
    return reply.code(404).send({ error: 'author not found' })
  }
  const author = rowToAuthor(row)
  const boardList = queryBoards({ authorId: row.id })
  return { author, boards: boardList }
})

// POST /api/boards/:id/like -> { id, likeCount }（持久化 +1）
app.post('/api/boards/:id/like', (req, reply) => {
  const clientKey = getClientKey(req)
  const ipLimit = hitPersistentRateLimit(`like-ip:${clientKey}`, { limit: 60, windowMs: 60 * 1000 })
  const boardLimit = hitPersistentRateLimit(`like-board:${clientKey}:${req.params.id}`, {
    limit: 5,
    windowMs: 60 * 1000,
  })
  if (!ipLimit.allowed || !boardLimit.allowed) {
    const resetAt = Math.max(ipLimit.resetAt, boardLimit.resetAt)
    return rateLimitReply(reply, { resetAt }, '操作太频繁，请稍后再试')
  }

  const row = stmt.boardById.get(req.params.id)
  if (!row || row.is_hidden === 1) return reply.code(404).send({ error: 'board not found' })
  stmt.bumpLike.run(row.id)
  const fresh = stmt.boardById.get(row.id)
  return { id: fresh.id, likeCount: fresh.like_count }
})

// POST /api/boards/:id/reports -> 游客举报；同 IP 每小时最多 5 次。
app.post('/api/boards/:id/reports', (req, reply) => {
  const row = stmt.boardById.get(req.params.id)
  if (!row || row.is_hidden === 1) return reply.code(404).send({ error: 'board not found' })

  const clientKey = getClientKey(req)
  const limit = hitPersistentRateLimit(`report:${clientKey}`, { limit: 5, windowMs: 60 * 60 * 1000 })
  if (!limit.allowed) return rateLimitReply(reply, limit, '举报太频繁，请稍后再试')

  const reason = cleanText(req.body?.reason)
  if (!REPORT_REASONS.has(reason)) return reply.code(400).send({ error: '字段无效：reason' })
  const detail = optionalText(req.body?.detail)
  const id = `rp-${randomBytes(8).toString('hex')}`
  stmt.insertReport.run({
    id,
    boardId: row.id,
    boardTitle: row.title,
    boardDescription: row.description,
    boardContent: row.content_text,
    boardAuthorId: row.author_id,
    boardUpdatedAt: row.updated_at,
    reason,
    detail,
    sourceKey: clientKey,
    createdAt: new Date().toISOString(),
  })
  return reply.code(201).send(rowToReport(stmt.reportById.get(id)))
})

// POST /api/submissions -> 游客投稿；只进入审核队列，不创建正式板。
app.post('/api/submissions', { bodyLimit: 1024 * 1024 }, (req, reply) => {
  const clientKey = getClientKey(req)
  const limit = hitPersistentRateLimit(`submission:${clientKey}`, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!limit.allowed) {
    return rateLimitReply(reply, limit, '投稿太频繁，请稍后再试')
  }

  const input = readSubmissionInput(req.body ?? {})
  const creatorAccount = getCreatorAccountFromRequest(req)
  const errorReply = validateSubmissionInput(input, reply, {
    hasCreatorSession: !!creatorAccount,
  })
  if (errorReply) return errorReply
  if (input.wantsCreatorProfile && !creatorAccount && stmt.creatorAccountByUsername.get(input.creatorUsername)) {
    return reply.code(409).send({ error: '这个用户名已被占用' })
  }

  const id = `s-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
  const now = new Date().toISOString()
  try {
    const createSubmission = db.transaction(() => {
      const contentHash = hashText(input.contentText)
      const duplicate = stmt.duplicateSubmissionBySourceContent.get(clientKey, contentHash)
      const spamReason =
        input.website
          ? 'honeypot'
          : findAbuseReason(
              input.title,
              input.description,
              input.contentText,
              input.submitterName,
              input.contact,
              input.creatorBio,
              input.creatorGuildName,
              input.creatorGuildRecruit,
              input.creatorGuildContact,
            ) || (duplicate ? 'duplicate_content' : '')
      const application = !spamReason && input.wantsCreatorProfile && !creatorAccount
        ? createCreatorApplication(input, now)
        : null
      stmt.insertSubmission.run({
        id,
        ...input,
        bossId: input.bossId ?? null,
        contact: input.contact ?? null,
        wantsCreatorProfile: input.wantsCreatorProfile ? 1 : 0,
        status: spamReason ? 'spam' : 'pending',
        sourceKey: clientKey,
        contentHash,
        spamReason: spamReason || null,
        authorId: creatorAccount?.author_id ?? application?.author?.id ?? null,
        createdAt: now,
      })
      const submission = rowToSubmission(stmt.submissionById.get(id))
      if (application?.creatorAuth) {
        submission.creatorAuth = application.creatorAuth
      }
      return submission
    })
    return reply.code(201).send(createSubmission())
  } catch (err) {
    const message = err instanceof Error ? err.message : '投稿失败'
    const status = err?.statusCode || (message.includes('占用') ? 409 : 400)
    return reply.code(status).send({ error: message })
  }
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
  auditLog({
    actorType: 'admin',
    action: 'board_create',
    entityType: 'board',
    entityId: id,
  })
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

// GET /api/admin/submissions -> 投稿审核队列（含已处理记录，pending 排最前）。
app.get('/api/admin/submissions', { preHandler: requireAuth }, () => {
  return stmt.allSubmissionsAdmin.all().map(rowToSubmission)
})

// GET /api/admin/creator-accounts -> 创作者账号列表；不暴露 password_hash。
app.get('/api/admin/creator-accounts', { preHandler: requireAuth }, () => {
  return stmt.allCreatorAccounts.all().map(rowToAdminCreatorAccount)
})

// GET /api/admin/reports -> 举报队列。
app.get('/api/admin/reports', { preHandler: requireAuth }, () => {
  return stmt.allReportsAdmin.all().map(rowToReport)
})

// GET /api/admin/audit-logs -> 最近审计日志。
app.get('/api/admin/audit-logs', { preHandler: requireAuth }, () => {
  return stmt.auditLogsAdmin.all().map(rowToAuditLog)
})

// POST /api/admin/raids -> 新增或更新团本。
app.post('/api/admin/raids', { preHandler: requireAuth }, (req, reply) => {
  const id = cleanText(req.body?.id) || `r-${randomBytes(5).toString('hex')}`
  const name = cleanText(req.body?.name)
  const patch = cleanText(req.body?.patch)
  if (!name) return reply.code(400).send({ error: '字段缺失：name' })
  if (!patch) return reply.code(400).send({ error: '字段缺失：patch' })
  stmt.upsertRaid.run({ id, name, patch })
  auditLog({
    actorType: 'admin',
    action: 'raid_upsert',
    entityType: 'raid',
    entityId: id,
  })
  return reply.code(201).send({
    ...stmt.raidById.get(id),
    boardCount: stmt.boardCountByRaid.get(id).n,
  })
})

// PUT /api/admin/raids/:id -> 更新团本。
app.put('/api/admin/raids/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.raidById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'raid not found' })
  const name = cleanText(req.body?.name) || row.name
  const patch = cleanText(req.body?.patch) || row.patch
  stmt.upsertRaid.run({ id: row.id, name, patch })
  auditLog({
    actorType: 'admin',
    action: 'raid_update',
    entityType: 'raid',
    entityId: row.id,
  })
  return {
    ...stmt.raidById.get(row.id),
    boardCount: stmt.boardCountByRaid.get(row.id).n,
  }
})

// DELETE /api/admin/raids/:id -> 无关联板、投稿、BOSS 时才允许删除。
app.delete('/api/admin/raids/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.raidById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'raid not found' })
  if (
    stmt.boardCountByRaidAny.get(row.id).n > 0 ||
    stmt.submissionCountByRaid.get(row.id).n > 0 ||
    stmt.bossCountByRaid.get(row.id).n > 0
  ) {
    return reply.code(409).send({ error: '该团本还有关联 BOSS、战术板或投稿，不能删除' })
  }
  stmt.deleteRaid.run(row.id)
  auditLog({
    actorType: 'admin',
    action: 'raid_delete',
    entityType: 'raid',
    entityId: row.id,
  })
  return { ok: true }
})

// POST /api/admin/bosses -> 新增或更新 BOSS。
app.post('/api/admin/bosses', { preHandler: requireAuth }, (req, reply) => {
  const id = cleanText(req.body?.id) || `b-${randomBytes(5).toString('hex')}`
  const raidId = cleanText(req.body?.raidId)
  const name = cleanText(req.body?.name)
  const order = Number(req.body?.order)
  if (!raidId || !stmt.raidById.get(raidId)) return reply.code(400).send({ error: '字段无效：raidId' })
  if (!name) return reply.code(400).send({ error: '字段缺失：name' })
  if (!Number.isInteger(order) || order < 1) return reply.code(400).send({ error: '字段无效：order' })
  stmt.upsertBoss.run({ id, raidId, name, order })
  auditLog({
    actorType: 'admin',
    action: 'boss_upsert',
    entityType: 'boss',
    entityId: id,
  })
  return reply.code(201).send(rowToBoss(stmt.bossById.get(id)))
})

// PUT /api/admin/bosses/:id -> 更新 BOSS。
app.put('/api/admin/bosses/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.bossById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'boss not found' })
  const raidId = cleanText(req.body?.raidId) || row.raid_id
  if (!stmt.raidById.get(raidId)) return reply.code(400).send({ error: '字段无效：raidId' })
  const name = cleanText(req.body?.name) || row.name
  const order = 'order' in (req.body ?? {}) ? Number(req.body.order) : row.order
  if (!Number.isInteger(order) || order < 1) return reply.code(400).send({ error: '字段无效：order' })
  stmt.upsertBoss.run({ id: row.id, raidId, name, order })
  auditLog({
    actorType: 'admin',
    action: 'boss_update',
    entityType: 'boss',
    entityId: row.id,
  })
  return rowToBoss(stmt.bossById.get(row.id))
})

// DELETE /api/admin/bosses/:id -> 无关联板、投稿时才允许删除。
app.delete('/api/admin/bosses/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.bossById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'boss not found' })
  if (stmt.boardCountByBoss.get(row.id).n > 0 || stmt.submissionCountByBoss.get(row.id).n > 0) {
    return reply.code(409).send({ error: '该 BOSS 还有关联战术板或投稿，不能删除' })
  }
  stmt.deleteBoss.run(row.id)
  auditLog({
    actorType: 'admin',
    action: 'boss_delete',
    entityType: 'boss',
    entityId: row.id,
  })
  return { ok: true }
})

// POST /api/admin/reports/:id/hide-board -> 处理举报并隐藏板。
app.post('/api/admin/reports/:id/hide-board', { preHandler: requireAuth }, (req, reply) => {
  const report = stmt.reportById.get(req.params.id)
  if (!report) return reply.code(404).send({ error: 'report not found' })
  if (report.status !== 'pending') return reply.code(409).send({ error: '该举报已处理' })
  const board = stmt.boardById.get(report.board_id)
  if (!board) return reply.code(404).send({ error: 'board not found' })
  const now = new Date().toISOString()
  db.prepare("UPDATE boards SET is_hidden = 1, hidden_by = 'admin', updated_at = ? WHERE id = ?")
    .run(now.slice(0, 10), board.id)
  stmt.updateReportStatus.run({
    id: report.id,
    status: 'hidden',
    resolutionNote: optionalText(req.body?.note),
    reviewedAt: now,
  })
  auditLog({
    actorType: 'admin',
    action: 'report_hide_board',
    entityType: 'report',
    entityId: report.id,
    detail: { boardId: board.id },
  })
  return rowToReport(stmt.reportById.get(report.id))
})

// POST /api/admin/reports/:id/dismiss -> 驳回举报。
app.post('/api/admin/reports/:id/dismiss', { preHandler: requireAuth }, (req, reply) => {
  const report = stmt.reportById.get(req.params.id)
  if (!report) return reply.code(404).send({ error: 'report not found' })
  if (report.status !== 'pending') return reply.code(409).send({ error: '该举报已处理' })
  stmt.updateReportStatus.run({
    id: report.id,
    status: 'dismissed',
    resolutionNote: optionalText(req.body?.note),
    reviewedAt: new Date().toISOString(),
  })
  auditLog({
    actorType: 'admin',
    action: 'report_dismiss',
    entityType: 'report',
    entityId: report.id,
  })
  return rowToReport(stmt.reportById.get(report.id))
})

// POST /api/admin/submissions/:id/approve -> 通过投稿并发布正式板。
app.post('/api/admin/submissions/:id/approve', { preHandler: requireAuth }, (req, reply) => {
  const submission = stmt.submissionById.get(req.params.id)
  if (!submission) return reply.code(404).send({ error: 'submission not found' })
  if (submission.status !== 'pending') {
    return reply.code(409).send({ error: '该投稿已处理' })
  }

  const body = req.body ?? {}
  const mode = body.mode || 'plainAuthor'
  let result
  try {
    const approve = db.transaction(() => {
      let authorRow = null
      if (mode === 'existingAuthor') {
        const authorId = cleanText(body.authorId)
        if (!authorId) throw new Error('字段缺失：authorId')
        authorRow = stmt.authorById.get(authorId)
        if (!authorRow) throw new Error('author not found')
        authorRow = promoteCreatorAuthor(authorRow)
      } else if (mode === 'createAuthor' || mode === 'plainAuthor') {
        authorRow = createAuthorFromSubmission(submission, mode, body)
      } else {
        throw new Error('字段无效：mode')
      }

      const boardRow = publishSubmission(submission, authorRow.id, body)
      const creatorAccount = recordCreatorSubmissionApproval(authorRow)
      const reviewedAt = new Date().toISOString()
      stmt.markSubmissionReviewed.run({
        id: submission.id,
        status: 'approved',
        reviewNote: optionalText(body.note),
        boardId: boardRow.id,
        authorId: authorRow.id,
        reviewedAt,
      })
      return {
        submission: rowToSubmission(stmt.submissionById.get(submission.id)),
        board: rowToBoard(boardRow),
        author: rowToAuthor(authorRow),
        creatorAccount: creatorAccount ? rowToCreatorAccount(creatorAccount) : null,
      }
    })
    result = approve()
    auditLog({
      actorType: 'admin',
      action: 'submission_approve',
      entityType: 'submission',
      entityId: submission.id,
      detail: { mode, boardId: result.board.id, authorId: result.author.id },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '审核通过失败'
    const status = message.includes('缺失') || message.includes('无效') ? 400 : 404
    return reply.code(status).send({ error: message })
  }

  return result
})

function markSubmissionStatus(id, status, note, reply) {
  const submission = stmt.submissionById.get(id)
  if (!submission) return reply.code(404).send({ error: 'submission not found' })
  if (submission.status !== 'pending') {
    return reply.code(409).send({ error: '该投稿已处理' })
  }
  stmt.markSubmissionReviewed.run({
    id,
    status,
    reviewNote: optionalText(note),
    boardId: null,
    authorId: submission.author_id,
    reviewedAt: new Date().toISOString(),
  })
  if (status === 'rejected' || status === 'spam') {
    resetCreatorSubmissionProgress(submission.author_id)
  }
  auditLog({
    actorType: 'admin',
    action: `submission_${status}`,
    entityType: 'submission',
    entityId: id,
    detail: { note: optionalText(note) },
  })
  return rowToSubmission(stmt.submissionById.get(id))
}

// POST /api/admin/submissions/:id/reject -> 驳回投稿，不发布。
app.post('/api/admin/submissions/:id/reject', { preHandler: requireAuth }, (req, reply) => {
  return markSubmissionStatus(req.params.id, 'rejected', req.body?.note, reply)
})

// POST /api/admin/submissions/:id/spam -> 标记垃圾，不发布。
app.post('/api/admin/submissions/:id/spam', { preHandler: requireAuth }, (req, reply) => {
  return markSubmissionStatus(req.params.id, 'spam', req.body?.note, reply)
})

// PUT /api/admin/creator-accounts/:id -> 管理员封禁 / 恢复创作者账号。
app.put('/api/admin/creator-accounts/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.creatorAccountById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'creator account not found' })
  const status = cleanText(req.body?.status)
  if (!['active', 'suspended'].includes(status)) {
    return reply.code(400).send({ error: '字段无效：status' })
  }
  stmt.updateCreatorAccountStatus.run({
    id: row.id,
    status,
    updatedAt: new Date().toISOString(),
  })
  if (status === 'suspended') {
    stmt.revokeCreatorSessionsByAccount.run({
      creatorAccountId: row.id,
      revokedAt: new Date().toISOString(),
    })
  }
  auditLog({
    actorType: 'admin',
    action: 'creator_account_update',
    entityType: 'creator_account',
    entityId: row.id,
    detail: { status },
  })
  return rowToCreatorAccount(stmt.creatorAccountById.get(row.id))
})

// POST /api/admin/creator-accounts/:id/reset-password -> 管理员人工重置密码。
app.post('/api/admin/creator-accounts/:id/reset-password', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.creatorAccountById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'creator account not found' })
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (password.length < 8) {
    return reply.code(400).send({ error: '密码长度至少 8 位' })
  }
  const now = new Date().toISOString()
  stmt.updateCreatorAccountPassword.run({
    id: row.id,
    passwordHash: hashPassword(password),
    updatedAt: now,
  })
  stmt.revokeCreatorSessionsByAccount.run({
    creatorAccountId: row.id,
    revokedAt: now,
  })
  auditLog({
    actorType: 'admin',
    action: 'creator_account_reset_password',
    entityType: 'creator_account',
    entityId: row.id,
  })
  return {
    user: rowToCreatorAccount(stmt.creatorAccountById.get(row.id)),
    revokedSessions: true,
  }
})

// GET /api/admin/export -> 全量导出当前 SQLite 业务数据，用于部署前备份。
app.get('/api/admin/export', { preHandler: requireAuth }, () => {
  return {
    raids: stmt.allRaids.all().map((r) => ({
      id: r.id,
      name: r.name,
      patch: r.patch,
      boardCount: stmt.boardCountByRaid.get(r.id).n,
    })),
    bosses: db.prepare('SELECT * FROM bosses ORDER BY raid_id ASC, "order" ASC').all().map(rowToBoss),
    authors: stmt.allAuthors.all().map(rowToAuthor),
    boards: stmt.allBoardsAdmin.all().map(rowToAdminBoard),
    submissions: stmt.allSubmissionsAdmin.all().map(rowToSubmission),
    creatorAccounts: stmt.allCreatorAccounts.all().map(rowToCreatorAccountExport),
  }
})

function requireArray(value, name, reply) {
  if (Array.isArray(value)) return value
  reply.code(400).send({ error: `字段必须是数组：${name}` })
  return null
}

// POST /api/admin/import -> 全量回灌导出数据；按 id upsert，不清空表。
app.post('/api/admin/import', { preHandler: requireAuth, bodyLimit: 10 * 1024 * 1024 }, (req, reply) => {
  const body = req.body ?? {}
  const raidRows = requireArray(body.raids, 'raids', reply)
  const bossRows = requireArray(body.bosses, 'bosses', reply)
  const authorRows = requireArray(body.authors, 'authors', reply)
  const boardRows = requireArray(body.boards, 'boards', reply)
  const submissionRows = body.submissions == null ? [] : requireArray(body.submissions, 'submissions', reply)
  const creatorAccountRows = body.creatorAccounts == null ? [] : requireArray(body.creatorAccounts, 'creatorAccounts', reply)
  if (
    !raidRows ||
    !bossRows ||
    !authorRows ||
    !boardRows ||
    !submissionRows ||
    !creatorAccountRows
  ) return reply

  const importAll = db.transaction(() => {
    for (const account of creatorAccountRows) {
      stmt.upsertCreatorAccount.run({
        id: account.id,
        email: account.email ?? `${account.id}@creator.local`,
        username: account.username ?? null,
        emailVerifiedAt: account.emailVerifiedAt ?? null,
        passwordHash: account.passwordHash ?? null,
        status: account.status ?? 'suspended',
        trustLevel: account.trustLevel ?? TRUST_TRUSTED,
        approvedSubmissionCount: account.approvedSubmissionCount ?? 0,
        authorId: account.authorId ?? null,
        contact: account.contact ?? null,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        lastLoginAt: account.lastLoginAt ?? null,
      })
    }
    for (const r of raidRows) {
      stmt.upsertRaid.run({ id: r.id, name: r.name, patch: r.patch })
    }
    for (const b of bossRows) {
      stmt.upsertBoss.run({ id: b.id, raidId: b.raidId, name: b.name, order: b.order })
    }
    for (const a of authorRows) {
      stmt.upsertAuthor.run({
        id: a.id,
        name: a.name,
        avatarUrl: a.avatarUrl ?? null,
        bio: a.bio ?? null,
        guildName: a.guildName ?? null,
        guildRecruit: a.guildRecruit ?? null,
        guildContact: a.guildContact ?? null,
        creatorAccountId: a.creatorAccountId ?? null,
        visibility: a.visibility ?? 'approved',
        moderationStatus: a.moderationStatus ?? 'clean',
        updatedAt: a.updatedAt ?? null,
      })
    }
    for (const b of boardRows) {
      stmt.upsertBoard.run({
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
        viewCount: b.viewCount ?? 0,
        likeCount: b.likeCount ?? 0,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })
    }
    for (const s of submissionRows) {
      stmt.upsertSubmission.run({
        id: s.id,
        title: s.title,
        raidId: s.raidId,
        bossId: s.bossId ?? null,
        difficulty: s.difficulty,
        seasonVersion: s.seasonVersion,
        description: s.description,
        contentText: s.contentText,
        submitterName: s.submitterName,
        contact: s.contact ?? null,
        wantsCreatorProfile: s.wantsCreatorProfile ? 1 : 0,
        creatorAvatarUrl: s.creatorAvatarUrl ?? null,
        creatorBio: s.creatorBio ?? null,
        creatorGuildName: s.creatorGuildName ?? null,
        creatorGuildRecruit: s.creatorGuildRecruit ?? null,
        creatorGuildContact: s.creatorGuildContact ?? null,
        status: s.status ?? 'pending',
        sourceKey: s.sourceKey ?? null,
        contentHash: s.contentHash ?? (s.contentText ? hashText(s.contentText) : null),
        spamReason: s.spamReason ?? null,
        reviewNote: s.reviewNote ?? null,
        boardId: s.boardId ?? null,
        authorId: s.authorId ?? null,
        createdAt: s.createdAt,
        reviewedAt: s.reviewedAt ?? null,
      })
    }
  })

  importAll()
  return {
    ok: true,
    counts: {
      raids: raidRows.length,
      bosses: bossRows.length,
      authors: authorRows.length,
      boards: boardRows.length,
      submissions: submissionRows.length,
      creatorAccounts: creatorAccountRows.length,
    },
  }
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
  ]
  const sets = []
  const params = []
  for (const [key, col, conv] of fields) {
    if (key in b) {
      sets.push(`${col} = ?`)
      params.push(conv(b[key]))
    }
  }
  if ('isHidden' in b) {
    sets.push('is_hidden = ?')
    params.push(b.isHidden ? 1 : 0)
    sets.push('hidden_by = ?')
    params.push(b.isHidden ? 'admin' : null)
  }
  const today = new Date().toISOString().slice(0, 10)
  sets.push('updated_at = ?')
  params.push(today)
  params.push(row.id)
  db.prepare(`UPDATE boards SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  auditLog({
    actorType: 'admin',
    action: 'board_update',
    entityType: 'board',
    entityId: row.id,
    detail: {
      fields: [
        ...fields.filter(([key]) => key in b).map(([key]) => key),
        ...('isHidden' in b ? ['isHidden'] : []),
      ],
    },
  })
  return rowToAdminBoard(stmt.boardById.get(row.id))
})

// DELETE /api/boards/:id -> { ok: true }
app.delete('/api/boards/:id', { preHandler: requireAuth }, (req, reply) => {
  const row = stmt.boardById.get(req.params.id)
  if (!row) return reply.code(404).send({ error: 'board not found' })
  stmt.deleteBoard.run(row.id)
  auditLog({
    actorType: 'admin',
    action: 'board_delete',
    entityType: 'board',
    entityId: row.id,
  })
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
    creatorAccountId: null,
    visibility: 'approved',
    moderationStatus: 'clean',
    updatedAt: new Date().toISOString(),
  })
  auditLog({
    actorType: 'admin',
    action: 'author_create',
    entityType: 'author',
    entityId: id,
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
    ['visibility', 'visibility'],
    ['moderationStatus', 'moderation_status'],
  ]
  const sets = []
  const params = []
  for (const [key, col] of fields) {
    if (key in a) {
      if (key === 'visibility' && !['semi_public', 'approved', 'hidden'].includes(a[key])) {
        return reply.code(400).send({ error: '字段无效：visibility' })
      }
      sets.push(`${col} = ?`)
      params.push(a[key] ?? null)
    }
  }
  if (sets.length > 0) {
    params.push(row.id)
    db.prepare(`UPDATE authors SET ${sets.join(', ')} WHERE id = ?`).run(...params)
    auditLog({
      actorType: 'admin',
      action: 'author_update',
      entityType: 'author',
      entityId: row.id,
      detail: { fields: fields.filter(([key]) => key in a).map(([key]) => key) },
    })
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
  auditLog({
    actorType: 'admin',
    action: 'author_delete',
    entityType: 'author',
    entityId: row.id,
  })
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
