#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'

const source = process.argv[2] || 'backups/remote-2026-06-02T16-00-49-960Z.json'
const output = process.argv[3] || 'worker/seed.sql'
const data = JSON.parse(readFileSync(source, 'utf8'))

function sql(value) {
  if (value === undefined || value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? '1' : '0'
  return `'${String(value).replace(/[ \t]+$/gm, '').replaceAll("'", "''")}'`
}

function insert(table, columns, rows) {
  return rows.map((row) => {
    const values = columns.map(([col, key, fallback]) => sql(row[key] ?? fallback ?? null))
    return `INSERT OR REPLACE INTO ${table} (${columns.map(([col]) => col).join(', ')}) VALUES (${values.join(', ')});`
  })
}

const creatorAccounts = data.creatorAccounts || data.creatorUsers || []
const lines = [
  'PRAGMA defer_foreign_keys = TRUE;',
  ...insert('creator_accounts', [
    ['id', 'id'],
    ['email', 'email'],
    ['username', 'username'],
    ['email_verified_at', 'emailVerifiedAt'],
    ['password_hash', 'passwordHash'],
    ['status', 'status', 'suspended'],
    ['author_id', 'authorId'],
    ['contact', 'contact'],
    ['created_at', 'createdAt'],
    ['updated_at', 'updatedAt'],
    ['last_login_at', 'lastLoginAt'],
  ], creatorAccounts),
  ...insert('raids', [
    ['id', 'id'],
    ['name', 'name'],
    ['patch', 'patch'],
  ], data.raids || []),
  ...insert('bosses', [
    ['id', 'id'],
    ['raid_id', 'raidId'],
    ['name', 'name'],
    ['"order"', 'order'],
  ], data.bosses || []),
  ...insert('authors', [
    ['id', 'id'],
    ['name', 'name'],
    ['avatar_url', 'avatarUrl'],
    ['bio', 'bio'],
    ['guild_name', 'guildName'],
    ['guild_recruit', 'guildRecruit'],
    ['guild_contact', 'guildContact'],
    ['creator_account_id', 'creatorAccountId'],
    ['visibility', 'visibility', 'approved'],
    ['moderation_status', 'moderationStatus', 'clean'],
    ['updated_at', 'updatedAt'],
  ], data.authors || []),
  ...insert('boards', [
    ['id', 'id'],
    ['title', 'title'],
    ['raid_id', 'raidId'],
    ['boss_id', 'bossId'],
    ['difficulty', 'difficulty'],
    ['season_version', 'seasonVersion'],
    ['content_text', 'contentText'],
    ['import_code', 'importCode'],
    ['description', 'description', ''],
    ['author_id', 'authorId'],
    ['is_hidden', 'isHidden', false],
    ['is_featured', 'isFeatured', false],
    ['view_count', 'viewCount', 0],
    ['like_count', 'likeCount', 0],
    ['created_at', 'createdAt'],
    ['updated_at', 'updatedAt'],
  ], data.boards || []),
  ...insert('submissions', [
    ['id', 'id'],
    ['title', 'title'],
    ['raid_id', 'raidId'],
    ['boss_id', 'bossId'],
    ['difficulty', 'difficulty'],
    ['season_version', 'seasonVersion'],
    ['description', 'description', ''],
    ['content_text', 'contentText'],
    ['submitter_name', 'submitterName'],
    ['contact', 'contact'],
    ['wants_creator_profile', 'wantsCreatorProfile', false],
    ['creator_avatar_url', 'creatorAvatarUrl'],
    ['creator_bio', 'creatorBio'],
    ['creator_guild_name', 'creatorGuildName'],
    ['creator_guild_recruit', 'creatorGuildRecruit'],
    ['creator_guild_contact', 'creatorGuildContact'],
    ['status', 'status', 'pending'],
    ['source_key', 'sourceKey'],
    ['review_note', 'reviewNote'],
    ['board_id', 'boardId'],
    ['author_id', 'authorId'],
    ['created_at', 'createdAt'],
    ['reviewed_at', 'reviewedAt'],
  ], data.submissions || []),
]

writeFileSync(output, `${lines.join('\n')}\n`)
console.log(JSON.stringify({
  source,
  output,
  counts: {
    raids: data.raids?.length || 0,
    bosses: data.bosses?.length || 0,
    authors: data.authors?.length || 0,
    boards: data.boards?.length || 0,
    submissions: data.submissions?.length || 0,
    creatorAccounts: creatorAccounts.length,
  },
}, null, 2))
