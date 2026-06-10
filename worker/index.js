const BOARD_ORDER = 'ORDER BY like_count DESC, view_count DESC, updated_at DESC'
const CREATOR_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PBKDF2_ITERATIONS = 100000
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

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function text(data, status = 200, headers = {}) {
  return new Response(data, { status, headers })
}

function allowedOrigins(env) {
  return new Set(
    String(env.CORS_ORIGINS || 'https://zhaobanzi.pages.dev,http://localhost:5173,http://127.0.0.1:5173')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin')
  const allowed = allowedOrigins(env)
  const headers = {
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
  }
  if (!origin || allowed.has(origin)) headers['Access-Control-Allow-Origin'] = origin || '*'
  return headers
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(request, env))) headers.set(key, value)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

async function readJson(request) {
  if (!request.headers.get('Content-Type')?.includes('application/json')) return {}
  try {
    return await request.json()
  } catch {
    return {}
  }
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function optionalText(value) {
  const textValue = cleanText(value)
  return textValue || null
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function nowIso() {
  return new Date().toISOString()
}

function randomId(prefix) {
  return `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`
}

function getClientKey(request) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded?.trim()) return forwarded.split(',')[0].trim()
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-real-ip') || 'unknown'
}

function base64url(bytes) {
  let raw = ''
  for (const b of bytes) raw += String.fromCharCode(b)
  return btoa(raw).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function fromBase64url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4)
  const raw = atob(padded)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))))
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(a)
  const right = new TextEncoder().encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i]
  return diff === 0
}

async function adminToken(secret) {
  const expires = Date.now() + 12 * 60 * 60 * 1000
  const body = `admin.${expires}.${crypto.randomUUID()}`
  return `${body}.${await hmac(secret, body)}`
}

async function verifyAdminToken(secret, token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 4 || parts[0] !== 'admin') return false
  const body = parts.slice(0, 3).join('.')
  if (Number(parts[1]) < Date.now()) return false
  return timingSafeEqual(parts[3], await hmac(secret, body))
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return `pbkdf2:${base64url(salt)}:${base64url(new Uint8Array(bits))}`
}

async function verifyPassword(password, stored) {
  const [kind, saltText, expected] = String(stored || '').split(':')
  if (kind !== 'pbkdf2' || !saltText || !expected) return false
  const salt = fromBase64url(saltText)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  )
  return timingSafeEqual(expected, base64url(new Uint8Array(bits)))
}

async function all(env, sql, params = []) {
  return (await env.DB.prepare(sql).bind(...params).all()).results || []
}

async function first(env, sql, params = []) {
  return await env.DB.prepare(sql).bind(...params).first()
}

async function run(env, sql, params = []) {
  return await env.DB.prepare(sql).bind(...params).run()
}

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

function rowToAdminBoard(row) {
  return { ...rowToBoard(row), isHidden: row.is_hidden === 1 }
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
    reviewNote: row.review_note ?? undefined,
    boardId: row.board_id ?? undefined,
    authorId: row.author_id ?? undefined,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
  }
}

function rowToCreatorAccount(row) {
  return {
    id: row.id,
    username: row.username,
    status: row.status,
    authorId: row.author_id ?? undefined,
    contact: row.contact ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? undefined,
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

async function raidWithCount(env, row) {
  return {
    id: row.id,
    name: row.name,
    patch: row.patch,
    boardCount: (await first(env, 'SELECT COUNT(*) AS n FROM boards WHERE raid_id = ? AND is_hidden = 0', [row.id])).n,
  }
}

async function queryBoards(env, { raidId, bossId, authorId, featured } = {}) {
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
  if (featured) where.push('is_featured = 1')
  return (await all(env, `SELECT * FROM boards WHERE ${where.join(' AND ')} ${BOARD_ORDER}`, params)).map(rowToBoard)
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
  }
}

async function validateSubmissionInput(env, input, hasCreatorSession) {
  for (const [key, label] of [
    ['title', '标题'],
    ['raidId', '团本'],
    ['bossId', 'BOSS'],
    ['difficulty', '难度'],
    ['contentText', '战术正文'],
    ['submitterName', '投稿署名'],
  ]) {
    if (!input[key]) return `字段缺失：${key}（${label}）`
  }
  if (!['heroic', 'mythic'].includes(input.difficulty)) return '字段无效：difficulty'
  const raid = await first(env, 'SELECT * FROM raids WHERE id = ?', [input.raidId])
  if (!raid) return '字段无效：raidId'
  input.seasonVersion = input.seasonVersion || raid.patch
  if (input.bossId && !(await first(env, 'SELECT * FROM bosses WHERE id = ?', [input.bossId]))) return '字段无效：bossId'
  if (input.wantsCreatorProfile && !hasCreatorSession) {
    const usernameError = validateCreatorUsername(input.creatorUsername)
    if (usernameError) return usernameError
    if (!input.creatorPassword) return '请填写密码'
    if (input.creatorPassword.length < 8) return '密码至少需要 8 位'
  }
  return ''
}

async function createCreatorAccountSession(env, accountId) {
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)))
  const createdAt = nowIso()
  await run(env, `
    INSERT INTO creator_sessions (
      id, creator_account_id, token_hash, created_at, expires_at, last_seen_at, revoked_at
    ) VALUES (?, ?, ?, ?, ?, ?, NULL)
  `, [
    randomId('cs'),
    accountId,
    await sha256Hex(token),
    createdAt,
    new Date(Date.now() + CREATOR_SESSION_TTL_MS).toISOString(),
    createdAt,
  ])
  return token
}

async function getCreatorAccountFromRequest(env, request) {
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const tokenHash = await sha256Hex(token)
  const session = await first(env, `
    SELECT * FROM creator_sessions
    WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
  `, [tokenHash, nowIso()])
  if (!session) return null
  const account = await first(env, 'SELECT * FROM creator_accounts WHERE id = ?', [session.creator_account_id])
  if (!account) return null
  await run(env, 'UPDATE creator_sessions SET last_seen_at = ? WHERE id = ?', [nowIso(), session.id])
  return account
}

async function createCreatorApplication(env, input, createdAt) {
  const username = normalizeUsername(input.creatorUsername)
  if (await first(env, 'SELECT * FROM creator_accounts WHERE username = ?', [username])) {
    const err = new Error('这个用户名已被占用')
    err.statusCode = 409
    throw err
  }
  const accountId = randomId('ca')
  const authorId = randomId('a')
  await run(env, `
    INSERT INTO creator_accounts (
      id, email, username, email_verified_at, password_hash, status, author_id, contact,
      created_at, updated_at, last_login_at
    ) VALUES (?, ?, ?, NULL, ?, 'active', NULL, ?, ?, ?, NULL)
  `, [
    accountId,
    `${accountId}@creator.local`,
    username,
    await hashPassword(input.creatorPassword),
    input.contact,
    createdAt,
    createdAt,
  ])
  await run(env, `
    INSERT INTO authors (
      id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
      creator_account_id, visibility, moderation_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'semi_public', 'clean', ?)
  `, [
    authorId,
    input.submitterName,
    input.creatorAvatarUrl,
    input.creatorBio,
    input.creatorGuildName,
    input.creatorGuildRecruit,
    input.creatorGuildContact,
    accountId,
    createdAt,
  ])
  await run(env, 'UPDATE creator_accounts SET author_id = ?, updated_at = ? WHERE id = ?', [authorId, createdAt, accountId])
  const account = await first(env, 'SELECT * FROM creator_accounts WHERE id = ?', [accountId])
  const author = await first(env, 'SELECT * FROM authors WHERE id = ?', [authorId])
  return {
    account,
    author,
    creatorAuth: {
      token: await createCreatorAccountSession(env, account.id),
      user: rowToCreatorAccount(account),
      author: rowToAuthor(author),
    },
  }
}

function readBoardDraft(body = {}, current = null) {
  return {
    title: 'title' in body ? cleanText(body.title) : (current?.title ?? ''),
    raidId: 'raidId' in body ? cleanText(body.raidId) : (current?.raid_id ?? ''),
    bossId: 'bossId' in body ? optionalText(body.bossId) : (current?.boss_id ?? null),
    difficulty: 'difficulty' in body ? cleanText(body.difficulty) : (current?.difficulty ?? ''),
    seasonVersion: 'seasonVersion' in body ? cleanText(body.seasonVersion) : (current?.season_version ?? ''),
    description: 'description' in body ? cleanText(body.description) : (current?.description ?? ''),
    contentText: 'contentText' in body
      ? (typeof body.contentText === 'string' ? body.contentText.trim() : '')
      : (current?.content_text ?? ''),
    isHidden: 'isHidden' in body ? body.isHidden === true : current?.is_hidden === 1,
  }
}

async function validateBoardDraft(env, input) {
  for (const [key, label] of [
    ['title', '标题'],
    ['raidId', '团本'],
    ['bossId', 'BOSS'],
    ['difficulty', '难度'],
    ['contentText', '战术正文'],
  ]) {
    if (!input[key]) return `字段缺失：${key}（${label}）`
  }
  if (!['heroic', 'mythic'].includes(input.difficulty)) return '字段无效：difficulty'
  const raid = await first(env, 'SELECT * FROM raids WHERE id = ?', [input.raidId])
  if (!raid) return '字段无效：raidId'
  if (input.bossId && !(await first(env, 'SELECT * FROM bosses WHERE id = ?', [input.bossId]))) return '字段无效：bossId'
  input.seasonVersion = input.seasonVersion || raid.patch
  return ''
}

async function getApprovedCreatorAuthor(env, account) {
  if (!account || account.status !== 'active') return { status: 403, error: '账号已被暂停，请联系管理员' }
  const author = account.author_id ? await first(env, 'SELECT * FROM authors WHERE id = ?', [account.author_id]) : null
  if (!author || author.visibility === 'hidden') return { status: 404, error: '作者主页不存在' }
  if (author.visibility !== 'approved') return { status: 403, error: '作者主页通过审核后才能直接发布战术板' }
  return { author }
}

async function promoteCreatorAuthor(env, authorRow) {
  if (!authorRow?.creator_account_id || authorRow.visibility === 'approved') return authorRow
  await run(env, `
    UPDATE authors
    SET visibility = 'approved', moderation_status = ?, updated_at = ?
    WHERE id = ?
  `, [authorRow.moderation_status ?? 'clean', nowIso(), authorRow.id])
  return await first(env, 'SELECT * FROM authors WHERE id = ?', [authorRow.id])
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
  for (const [key, value, max] of [
    ['name', next.name, 40],
    ['avatarUrl', next.avatarUrl, 240],
    ['bio', next.bio, 120],
    ['guildName', next.guildName, 40],
    ['guildRecruit', next.guildRecruit, 120],
    ['guildContact', next.guildContact, 80],
  ]) {
    if (value && value.length > max) throw new Error(`字段过长：${key}`)
  }
  const combined = Object.values(next).filter(Boolean).join('\n').toLowerCase()
  if (['黄暴', '博彩', '裸聊', '约炮'].some((word) => combined.includes(word))) {
    throw new Error('作者资料包含暂不支持公开展示的内容')
  }
  return next
}

async function requireAdmin(env, request) {
  const secret = env.ADMIN_PASSWORD
  if (!secret || secret === 'planshare-admin') return { error: '后台未配置 ADMIN_PASSWORD', status: 500 }
  const header = request.headers.get('Authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!(await verifyAdminToken(secret, token))) return { error: '未授权', status: 401 }
  return {}
}

async function requireCreator(env, request) {
  const account = await getCreatorAccountFromRequest(env, request)
  if (!account) return { error: '未授权', status: 401 }
  return { account }
}

async function createAuthorFromSubmission(env, submission, mode, body = {}) {
  const name = cleanText(body.authorName) || submission.submitter_name
  const useProfile = mode === 'createAuthor'
  const linkedAuthor = submission.author_id ? await first(env, 'SELECT * FROM authors WHERE id = ?', [submission.author_id]) : null
  if (linkedAuthor?.creator_account_id) {
    const profile = readCreatorProfilePatch({
      name,
      avatarUrl: useProfile ? (optionalText(body.avatarUrl) ?? submission.creator_avatar_url) : linkedAuthor.avatar_url,
      bio: useProfile ? (optionalText(body.bio) ?? submission.creator_bio) : linkedAuthor.bio,
      guildName: useProfile ? (optionalText(body.guildName) ?? submission.creator_guild_name) : linkedAuthor.guild_name,
      guildRecruit: useProfile ? (optionalText(body.guildRecruit) ?? submission.creator_guild_recruit) : linkedAuthor.guild_recruit,
      guildContact: useProfile ? (optionalText(body.guildContact) ?? submission.creator_guild_contact) : linkedAuthor.guild_contact,
    }, linkedAuthor)
    await run(env, `
      UPDATE authors
      SET name = ?, avatar_url = ?, bio = ?, guild_name = ?, guild_recruit = ?, guild_contact = ?,
          visibility = 'approved', moderation_status = ?, updated_at = ?
      WHERE id = ?
    `, [
      profile.name,
      profile.avatarUrl,
      profile.bio,
      profile.guildName,
      profile.guildRecruit,
      profile.guildContact,
      linkedAuthor.moderation_status ?? 'clean',
      nowIso(),
      linkedAuthor.id,
    ])
    return await first(env, 'SELECT * FROM authors WHERE id = ?', [linkedAuthor.id])
  }
  const id = randomId('a')
  await run(env, `
    INSERT INTO authors (
      id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
      creator_account_id, visibility, moderation_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'approved', 'clean', ?)
  `, [
    id,
    name,
    useProfile ? (optionalText(body.avatarUrl) ?? submission.creator_avatar_url) : null,
    useProfile ? (optionalText(body.bio) ?? submission.creator_bio) : null,
    useProfile ? (optionalText(body.guildName) ?? submission.creator_guild_name) : null,
    useProfile ? (optionalText(body.guildRecruit) ?? submission.creator_guild_recruit) : null,
    useProfile ? (optionalText(body.guildContact) ?? submission.creator_guild_contact) : null,
    nowIso(),
  ])
  return await first(env, 'SELECT * FROM authors WHERE id = ?', [id])
}

async function publishSubmission(env, submission, authorId, body = {}) {
  const id = `p-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
  const date = today()
  await run(env, `
    INSERT INTO boards (
      id, title, raid_id, boss_id, difficulty, season_version, content_text,
      import_code, description, author_id, is_hidden, is_featured,
      view_count, like_count, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, 0, 0, ?, ?)
  `, [
    id,
    submission.title,
    submission.raid_id,
    submission.boss_id ?? null,
    submission.difficulty,
    submission.season_version,
    submission.content_text,
    submission.description,
    authorId,
    body.isFeatured ? 1 : 0,
    date,
    date,
  ])
  return await first(env, 'SELECT * FROM boards WHERE id = ?', [id])
}

async function handle(request, env) {
  const url = new URL(request.url)
  const path = url.pathname
  const method = request.method

  if (!path.startsWith('/api/')) return json({ error: '未找到' }, 404)
  if (method === 'OPTIONS') return text('', 204, corsHeaders(request, env))
  if (!env.DB) return json({ error: 'D1 未绑定' }, 500)

  if (method === 'POST' && path === '/api/admin/login') {
    const body = await readJson(request)
    if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) return json({ error: '密码错误' }, 401)
    return json({ token: await adminToken(env.ADMIN_PASSWORD) })
  }

  if (method === 'POST' && path === '/api/creator/login') {
    const body = await readJson(request)
    const username = normalizeUsername(body.username)
    const password = typeof body.password === 'string' ? body.password : ''
    const account = username ? await first(env, 'SELECT * FROM creator_accounts WHERE username = ?', [username]) : null
    if (account?.status === 'suspended') return json({ error: '账号已被暂停，请联系管理员' }, 403)
    if (!account || account.status !== 'active' || !(await verifyPassword(password, account.password_hash))) {
      return json({ error: '用户名或密码错误' }, 401)
    }
    const at = nowIso()
    await run(env, 'UPDATE creator_accounts SET updated_at = ?, last_login_at = ? WHERE id = ?', [at, at, account.id])
    const fresh = await first(env, 'SELECT * FROM creator_accounts WHERE id = ?', [account.id])
    const author = fresh.author_id ? await first(env, 'SELECT * FROM authors WHERE id = ?', [fresh.author_id]) : null
    return json({
      token: await createCreatorAccountSession(env, fresh.id),
      user: rowToCreatorAccount(fresh),
      author: author ? rowToAuthor(author) : null,
    })
  }

  if (method === 'GET' && path === '/api/creator/me') {
    const auth = await requireCreator(env, request)
    if (auth.error) return json({ error: auth.error }, auth.status)
    const author = auth.account.author_id ? await first(env, 'SELECT * FROM authors WHERE id = ?', [auth.account.author_id]) : null
    return json({ user: rowToCreatorAccount(auth.account), author: author ? rowToAuthor(author) : null })
  }

  if (method === 'PUT' && path === '/api/creator/profile') {
    const auth = await requireCreator(env, request)
    if (auth.error) return json({ error: auth.error }, auth.status)
    if (auth.account.status !== 'active') return json({ error: '账号已被暂停，请联系管理员' }, 403)
    const author = auth.account.author_id ? await first(env, 'SELECT * FROM authors WHERE id = ?', [auth.account.author_id]) : null
    if (!author || author.visibility === 'hidden') return json({ error: '作者主页不存在' }, 404)
    let profile
    try {
      profile = readCreatorProfilePatch(await readJson(request), author)
    } catch (err) {
      return json({ error: err.message || '作者资料无效' }, 400)
    }
    const nextVisibility = author.visibility === 'draft' ? 'semi_public' : author.visibility
    await run(env, `
      UPDATE authors
      SET name = ?, avatar_url = ?, bio = ?, guild_name = ?, guild_recruit = ?, guild_contact = ?,
          visibility = ?, moderation_status = ?, updated_at = ?
      WHERE id = ?
    `, [
      profile.name,
      profile.avatarUrl,
      profile.bio,
      profile.guildName,
      profile.guildRecruit,
      profile.guildContact,
      nextVisibility,
      author.moderation_status ?? 'clean',
      nowIso(),
      author.id,
    ])
    const freshAuthor = await first(env, 'SELECT * FROM authors WHERE id = ?', [author.id])
    const freshAccount = await first(env, 'SELECT * FROM creator_accounts WHERE id = ?', [auth.account.id])
    return json({ user: rowToCreatorAccount(freshAccount), author: rowToAuthor(freshAuthor) })
  }

  if (method === 'POST' && path === '/api/creator/logout') {
    const header = request.headers.get('Authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    if (token) await run(env, 'UPDATE creator_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', [nowIso(), await sha256Hex(token)])
    return json({ ok: true })
  }

  if (method === 'GET' && path === '/api/creator/boards') {
    const auth = await requireCreator(env, request)
    if (auth.error) return json({ error: auth.error }, auth.status)
    const approved = await getApprovedCreatorAuthor(env, auth.account)
    if (approved.error) return json({ error: approved.error }, approved.status)
    return json((await all(env, 'SELECT * FROM boards WHERE author_id = ? ORDER BY updated_at DESC', [approved.author.id])).map(rowToAdminBoard))
  }

  if (method === 'POST' && path === '/api/creator/boards') {
    const auth = await requireCreator(env, request)
    if (auth.error) return json({ error: auth.error }, auth.status)
    const approved = await getApprovedCreatorAuthor(env, auth.account)
    if (approved.error) return json({ error: approved.error }, approved.status)
    const input = readBoardDraft(await readJson(request))
    const error = await validateBoardDraft(env, input)
    if (error) return json({ error }, 400)
    const id = `p-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
    const date = today()
    await run(env, `
      INSERT INTO boards (
        id, title, raid_id, boss_id, difficulty, season_version, content_text,
        import_code, description, author_id, is_hidden, is_featured,
        view_count, like_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, 0, 0, 0, ?, ?)
    `, [id, input.title, input.raidId, input.bossId, input.difficulty, input.seasonVersion, input.contentText, input.description, approved.author.id, date, date])
    return json(rowToAdminBoard(await first(env, 'SELECT * FROM boards WHERE id = ?', [id])), 201)
  }

  const creatorBoardMatch = path.match(/^\/api\/creator\/boards\/([^/]+)$/)
  if (creatorBoardMatch && (method === 'PUT' || method === 'DELETE')) {
    const auth = await requireCreator(env, request)
    if (auth.error) return json({ error: auth.error }, auth.status)
    const approved = await getApprovedCreatorAuthor(env, auth.account)
    if (approved.error) return json({ error: approved.error }, approved.status)
    const row = await first(env, 'SELECT * FROM boards WHERE id = ?', [decodeURIComponent(creatorBoardMatch[1])])
    if (!row || row.author_id !== approved.author.id) return json({ error: 'board not found' }, 404)
    if (method === 'DELETE') {
      await run(env, 'UPDATE boards SET is_hidden = 1, updated_at = ? WHERE id = ?', [today(), row.id])
      return json({ ok: true })
    }
    const body = await readJson(request)
    const input = readBoardDraft(body, row)
    const error = await validateBoardDraft(env, input)
    if (error) return json({ error }, 400)
    const fields = [
      ['title', 'title', input.title],
      ['raidId', 'raid_id', input.raidId],
      ['bossId', 'boss_id', input.bossId ?? null],
      ['difficulty', 'difficulty', input.difficulty],
      ['seasonVersion', 'season_version', input.seasonVersion],
      ['contentText', 'content_text', input.contentText],
      ['description', 'description', input.description],
      ['isHidden', 'is_hidden', input.isHidden ? 1 : 0],
    ]
    const sets = []
    const params = []
    for (const [key, col, value] of fields) {
      if (key in body) {
        sets.push(`${col} = ?`)
        params.push(value)
      }
    }
    sets.push('updated_at = ?')
    params.push(today(), row.id)
    await run(env, `UPDATE boards SET ${sets.join(', ')} WHERE id = ?`, params)
    return json(rowToAdminBoard(await first(env, 'SELECT * FROM boards WHERE id = ?', [row.id])))
  }

  if (method === 'GET' && path === '/api/raids') {
    const rows = await all(env, 'SELECT * FROM raids')
    return json(await Promise.all(rows.map((row) => raidWithCount(env, row))))
  }

  const raidMatch = path.match(/^\/api\/raids\/([^/]+)$/)
  if (method === 'GET' && raidMatch) {
    const row = await first(env, 'SELECT * FROM raids WHERE id = ?', [decodeURIComponent(raidMatch[1])])
    if (!row) return json({ error: 'raid not found' }, 404)
    return json({
      raid: await raidWithCount(env, row),
      bosses: (await all(env, 'SELECT * FROM bosses WHERE raid_id = ? ORDER BY "order" ASC', [row.id])).map(rowToBoss),
    })
  }

  if (method === 'GET' && path === '/api/boards') {
    return json(await queryBoards(env, {
      raidId: url.searchParams.get('raidId'),
      bossId: url.searchParams.get('bossId'),
      authorId: url.searchParams.get('authorId'),
      featured: ['1', 'true'].includes(url.searchParams.get('featured') || ''),
    }))
  }

  const boardLikeMatch = path.match(/^\/api\/boards\/([^/]+)\/like$/)
  if (method === 'POST' && boardLikeMatch) {
    const id = decodeURIComponent(boardLikeMatch[1])
    const row = await first(env, 'SELECT * FROM boards WHERE id = ?', [id])
    if (!row || row.is_hidden === 1) return json({ error: 'board not found' }, 404)
    await run(env, 'UPDATE boards SET like_count = like_count + 1 WHERE id = ?', [id])
    const fresh = await first(env, 'SELECT id, like_count FROM boards WHERE id = ?', [id])
    return json({ id: fresh.id, likeCount: fresh.like_count })
  }

  const boardMatch = path.match(/^\/api\/boards\/([^/]+)$/)
  if (method === 'GET' && boardMatch) {
    const id = decodeURIComponent(boardMatch[1])
    const row = await first(env, 'SELECT * FROM boards WHERE id = ?', [id])
    if (!row || row.is_hidden === 1) return json({ error: 'board not found' }, 404)
    await run(env, 'UPDATE boards SET view_count = view_count + 1 WHERE id = ?', [id])
    const fresh = await first(env, 'SELECT * FROM boards WHERE id = ?', [id])
    const raidRow = await first(env, 'SELECT * FROM raids WHERE id = ?', [fresh.raid_id])
    const bossRow = fresh.boss_id ? await first(env, 'SELECT * FROM bosses WHERE id = ?', [fresh.boss_id]) : null
    const authorRow = await first(env, 'SELECT * FROM authors WHERE id = ?', [fresh.author_id])
    return json({
      board: rowToBoard(fresh),
      raid: raidRow ? await raidWithCount(env, raidRow) : null,
      boss: bossRow ? rowToBoss(bossRow) : null,
      author: authorRow ? rowToAuthor(authorRow) : null,
    })
  }

  if (method === 'GET' && path === '/api/authors') {
    return json((await all(env, "SELECT * FROM authors WHERE visibility = 'approved'")).map(rowToAuthor))
  }

  const authorMatch = path.match(/^\/api\/authors\/([^/]+)$/)
  if (method === 'GET' && authorMatch) {
    const row = await first(env, 'SELECT * FROM authors WHERE id = ?', [decodeURIComponent(authorMatch[1])])
    if (!row || !['semi_public', 'approved'].includes(row.visibility ?? 'approved')) return json({ error: 'author not found' }, 404)
    return json({ author: rowToAuthor(row), boards: await queryBoards(env, { authorId: row.id }) })
  }

  if (method === 'POST' && path === '/api/submissions') {
    const input = readSubmissionInput(await readJson(request))
    const creatorAccount = await getCreatorAccountFromRequest(env, request)
    const error = await validateSubmissionInput(env, input, !!creatorAccount)
    if (error) return json({ error }, 400)
    const id = `s-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
    const createdAt = nowIso()
    try {
      const application = input.wantsCreatorProfile && !creatorAccount ? await createCreatorApplication(env, input, createdAt) : null
      await run(env, `
        INSERT INTO submissions (
          id, title, raid_id, boss_id, difficulty, season_version, description,
          content_text, submitter_name, contact, wants_creator_profile,
          creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit,
          creator_guild_contact, status, source_key, author_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `, [
        id,
        input.title,
        input.raidId,
        input.bossId,
        input.difficulty,
        input.seasonVersion,
        input.description,
        input.contentText,
        input.submitterName,
        input.contact,
        input.wantsCreatorProfile ? 1 : 0,
        input.creatorAvatarUrl,
        input.creatorBio,
        input.creatorGuildName,
        input.creatorGuildRecruit,
        input.creatorGuildContact,
        getClientKey(request),
        creatorAccount?.author_id ?? application?.author?.id ?? null,
        createdAt,
      ])
      const submission = rowToSubmission(await first(env, 'SELECT * FROM submissions WHERE id = ?', [id]))
      if (application?.creatorAuth) submission.creatorAuth = application.creatorAuth
      return json(submission, 201)
    } catch (err) {
      return json({ error: err.message || '投稿失败' }, err.statusCode || 400)
    }
  }

  const admin = path.startsWith('/api/admin/') || (path === '/api/boards' && method === 'POST') || (boardMatch && ['PUT', 'DELETE'].includes(method)) || (path === '/api/authors' && method === 'POST') || (authorMatch && ['PUT', 'DELETE'].includes(method))
  if (admin) {
    const auth = await requireAdmin(env, request)
    if (auth.error) return json({ error: auth.error }, auth.status)
  }

  if (method === 'POST' && path === '/api/boards') {
    const b = await readJson(request)
    for (const key of ['title', 'raidId', 'difficulty', 'seasonVersion', 'contentText', 'authorId']) {
      if (b[key] == null || b[key] === '') return json({ error: `字段缺失：${key}` }, 400)
    }
    const id = `p-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
    const date = today()
    await run(env, `
      INSERT INTO boards (
        id, title, raid_id, boss_id, difficulty, season_version, content_text,
        import_code, description, author_id, is_hidden, is_featured,
        view_count, like_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 0, ?, 0, 0, ?, ?)
    `, [id, b.title, b.raidId, b.bossId ?? null, b.difficulty, b.seasonVersion, b.contentText, b.description ?? '', b.authorId, b.isFeatured ? 1 : 0, date, date])
    return json(rowToBoard(await first(env, 'SELECT * FROM boards WHERE id = ?', [id])), 201)
  }

  if (method === 'GET' && path === '/api/admin/boards') {
    return json((await all(env, 'SELECT * FROM boards ORDER BY updated_at DESC')).map(rowToAdminBoard))
  }

  if (method === 'GET' && path === '/api/admin/authors') {
    const rows = await all(env, 'SELECT * FROM authors')
    return json(await Promise.all(rows.map(async (row) => ({
      ...rowToAuthor(row),
      boardCount: (await first(env, 'SELECT COUNT(*) AS n FROM boards WHERE author_id = ?', [row.id])).n,
    }))))
  }

  if (method === 'GET' && path === '/api/admin/submissions') {
    return json((await all(env, `
      SELECT * FROM submissions
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, created_at DESC
    `)).map(rowToSubmission))
  }

  const approveMatch = path.match(/^\/api\/admin\/submissions\/([^/]+)\/approve$/)
  if (method === 'POST' && approveMatch) {
    const submission = await first(env, 'SELECT * FROM submissions WHERE id = ?', [decodeURIComponent(approveMatch[1])])
    if (!submission) return json({ error: 'submission not found' }, 404)
    if (submission.status !== 'pending') return json({ error: '该投稿已处理' }, 409)
    const body = await readJson(request)
    const mode = body.mode || 'plainAuthor'
    try {
      let authorRow = null
      if (mode === 'existingAuthor') {
        const authorId = cleanText(body.authorId)
        if (!authorId) throw new Error('字段缺失：authorId')
        authorRow = await first(env, 'SELECT * FROM authors WHERE id = ?', [authorId])
        if (!authorRow) throw new Error('author not found')
        authorRow = await promoteCreatorAuthor(env, authorRow)
      } else if (mode === 'createAuthor' || mode === 'plainAuthor') {
        authorRow = await createAuthorFromSubmission(env, submission, mode, body)
      } else {
        throw new Error('字段无效：mode')
      }
      const boardRow = await publishSubmission(env, submission, authorRow.id, body)
      await run(env, `
        UPDATE submissions
        SET status = 'approved', review_note = ?, board_id = ?, author_id = ?, reviewed_at = ?
        WHERE id = ?
      `, [optionalText(body.note), boardRow.id, authorRow.id, nowIso(), submission.id])
      return json({
        submission: rowToSubmission(await first(env, 'SELECT * FROM submissions WHERE id = ?', [submission.id])),
        board: rowToBoard(boardRow),
        author: rowToAuthor(authorRow),
      })
    } catch (err) {
      const message = err.message || '审核通过失败'
      return json({ error: message }, message.includes('缺失') || message.includes('无效') ? 400 : 404)
    }
  }

  const markMatch = path.match(/^\/api\/admin\/submissions\/([^/]+)\/(reject|spam)$/)
  if (method === 'POST' && markMatch) {
    const submission = await first(env, 'SELECT * FROM submissions WHERE id = ?', [decodeURIComponent(markMatch[1])])
    if (!submission) return json({ error: 'submission not found' }, 404)
    if (submission.status !== 'pending') return json({ error: '该投稿已处理' }, 409)
    const body = await readJson(request)
    await run(env, `
      UPDATE submissions
      SET status = ?, review_note = ?, board_id = NULL, author_id = NULL, reviewed_at = ?
      WHERE id = ?
    `, [markMatch[2] === 'spam' ? 'spam' : 'rejected', optionalText(body.note), nowIso(), submission.id])
    return json(rowToSubmission(await first(env, 'SELECT * FROM submissions WHERE id = ?', [submission.id])))
  }

  const creatorAccountMatch = path.match(/^\/api\/admin\/creator-accounts\/([^/]+)$/)
  if (method === 'PUT' && creatorAccountMatch) {
    const row = await first(env, 'SELECT * FROM creator_accounts WHERE id = ?', [decodeURIComponent(creatorAccountMatch[1])])
    if (!row) return json({ error: 'creator account not found' }, 404)
    const status = cleanText((await readJson(request)).status)
    if (!['active', 'suspended'].includes(status)) return json({ error: '字段无效：status' }, 400)
    await run(env, 'UPDATE creator_accounts SET status = ?, updated_at = ? WHERE id = ?', [status, nowIso(), row.id])
    if (status === 'suspended') await run(env, 'UPDATE creator_sessions SET revoked_at = ? WHERE creator_account_id = ? AND revoked_at IS NULL', [nowIso(), row.id])
    return json(rowToCreatorAccount(await first(env, 'SELECT * FROM creator_accounts WHERE id = ?', [row.id])))
  }

  if (method === 'GET' && path === '/api/admin/export') {
    const raidRows = await all(env, 'SELECT * FROM raids')
    return json({
      raids: await Promise.all(raidRows.map((row) => raidWithCount(env, row))),
      bosses: (await all(env, 'SELECT * FROM bosses ORDER BY raid_id ASC, "order" ASC')).map(rowToBoss),
      authors: (await all(env, 'SELECT * FROM authors')).map(rowToAuthor),
      boards: (await all(env, 'SELECT * FROM boards ORDER BY updated_at DESC')).map(rowToAdminBoard),
      submissions: (await all(env, `
        SELECT * FROM submissions
        ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 WHEN 'rejected' THEN 2 ELSE 3 END, created_at DESC
      `)).map(rowToSubmission),
      creatorAccounts: (await all(env, 'SELECT * FROM creator_accounts ORDER BY updated_at DESC')).map(rowToCreatorAccountExport),
    })
  }

  if (method === 'POST' && path === '/api/admin/import') {
    const body = await readJson(request)
    for (const name of ['raids', 'bosses', 'authors', 'boards']) {
      if (!Array.isArray(body[name])) return json({ error: `字段必须是数组：${name}` }, 400)
    }
    const submissions = Array.isArray(body.submissions) ? body.submissions : []
    const creatorAccounts = Array.isArray(body.creatorAccounts) ? body.creatorAccounts : []
    for (const account of creatorAccounts) {
      await run(env, `
        INSERT INTO creator_accounts (
          id, email, username, email_verified_at, password_hash, status, author_id, contact,
          created_at, updated_at, last_login_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          email = excluded.email, username = excluded.username, email_verified_at = excluded.email_verified_at,
          password_hash = excluded.password_hash, status = excluded.status, author_id = excluded.author_id,
          contact = excluded.contact, created_at = excluded.created_at, updated_at = excluded.updated_at,
          last_login_at = excluded.last_login_at
      `, [account.id, account.email ?? `${account.id}@creator.local`, account.username ?? null, account.emailVerifiedAt ?? null, account.passwordHash ?? null, account.status ?? 'suspended', account.authorId ?? null, account.contact ?? null, account.createdAt, account.updatedAt, account.lastLoginAt ?? null])
    }
    for (const r of body.raids) {
      await run(env, 'INSERT INTO raids (id, name, patch) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, patch = excluded.patch', [r.id, r.name, r.patch])
    }
    for (const b of body.bosses) {
      await run(env, 'INSERT INTO bosses (id, raid_id, name, "order") VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET raid_id = excluded.raid_id, name = excluded.name, "order" = excluded."order"', [b.id, b.raidId, b.name, b.order])
    }
    for (const a of body.authors) {
      await run(env, `
        INSERT INTO authors (
          id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
          creator_account_id, visibility, moderation_status, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name, avatar_url = excluded.avatar_url, bio = excluded.bio,
          guild_name = excluded.guild_name, guild_recruit = excluded.guild_recruit,
          guild_contact = excluded.guild_contact, creator_account_id = COALESCE(excluded.creator_account_id, authors.creator_account_id),
          visibility = COALESCE(excluded.visibility, authors.visibility),
          moderation_status = COALESCE(excluded.moderation_status, authors.moderation_status),
          updated_at = COALESCE(excluded.updated_at, authors.updated_at)
      `, [a.id, a.name, a.avatarUrl ?? null, a.bio ?? null, a.guildName ?? null, a.guildRecruit ?? null, a.guildContact ?? null, a.creatorAccountId ?? null, a.visibility ?? 'approved', a.moderationStatus ?? 'clean', a.updatedAt ?? null])
    }
    for (const b of body.boards) {
      await run(env, `
        INSERT INTO boards (
          id, title, raid_id, boss_id, difficulty, season_version, content_text,
          import_code, description, author_id, is_hidden, is_featured,
          view_count, like_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title, raid_id = excluded.raid_id, boss_id = excluded.boss_id,
          difficulty = excluded.difficulty, season_version = excluded.season_version,
          content_text = excluded.content_text, import_code = excluded.import_code,
          description = excluded.description, author_id = excluded.author_id,
          is_hidden = excluded.is_hidden, is_featured = excluded.is_featured,
          view_count = excluded.view_count, like_count = excluded.like_count,
          created_at = excluded.created_at, updated_at = excluded.updated_at
      `, [b.id, b.title, b.raidId, b.bossId ?? null, b.difficulty, b.seasonVersion, b.contentText, b.importCode ?? null, b.description, b.authorId, b.isHidden ? 1 : 0, b.isFeatured ? 1 : 0, b.viewCount ?? 0, b.likeCount ?? 0, b.createdAt, b.updatedAt])
    }
    for (const s of submissions) {
      await run(env, `
        INSERT INTO submissions (
          id, title, raid_id, boss_id, difficulty, season_version, description,
          content_text, submitter_name, contact, wants_creator_profile,
          creator_avatar_url, creator_bio, creator_guild_name, creator_guild_recruit,
          creator_guild_contact, status, source_key, review_note, board_id, author_id,
          created_at, reviewed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title, raid_id = excluded.raid_id, boss_id = excluded.boss_id,
          difficulty = excluded.difficulty, season_version = excluded.season_version,
          description = excluded.description, content_text = excluded.content_text,
          submitter_name = excluded.submitter_name, contact = excluded.contact,
          wants_creator_profile = excluded.wants_creator_profile,
          creator_avatar_url = excluded.creator_avatar_url, creator_bio = excluded.creator_bio,
          creator_guild_name = excluded.creator_guild_name, creator_guild_recruit = excluded.creator_guild_recruit,
          creator_guild_contact = excluded.creator_guild_contact, status = excluded.status,
          source_key = excluded.source_key, review_note = excluded.review_note,
          board_id = excluded.board_id, author_id = excluded.author_id,
          created_at = excluded.created_at, reviewed_at = excluded.reviewed_at
      `, [s.id, s.title, s.raidId, s.bossId ?? null, s.difficulty, s.seasonVersion, s.description, s.contentText, s.submitterName, s.contact ?? null, s.wantsCreatorProfile ? 1 : 0, s.creatorAvatarUrl ?? null, s.creatorBio ?? null, s.creatorGuildName ?? null, s.creatorGuildRecruit ?? null, s.creatorGuildContact ?? null, s.status ?? 'pending', s.sourceKey ?? null, s.reviewNote ?? null, s.boardId ?? null, s.authorId ?? null, s.createdAt, s.reviewedAt ?? null])
    }
    return json({ ok: true, counts: { raids: body.raids.length, bosses: body.bosses.length, authors: body.authors.length, boards: body.boards.length, submissions: submissions.length, creatorAccounts: creatorAccounts.length } })
  }

  if (boardMatch && (method === 'PUT' || method === 'DELETE')) {
    const id = decodeURIComponent(boardMatch[1])
    const row = await first(env, 'SELECT * FROM boards WHERE id = ?', [id])
    if (!row) return json({ error: 'board not found' }, 404)
    if (method === 'DELETE') {
      await run(env, 'DELETE FROM boards WHERE id = ?', [id])
      return json({ ok: true })
    }
    const body = await readJson(request)
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
      if (key in body) {
        sets.push(`${col} = ?`)
        params.push(conv(body[key]))
      }
    }
    sets.push('updated_at = ?')
    params.push(today(), id)
    await run(env, `UPDATE boards SET ${sets.join(', ')} WHERE id = ?`, params)
    return json(rowToAdminBoard(await first(env, 'SELECT * FROM boards WHERE id = ?', [id])))
  }

  if (method === 'POST' && path === '/api/authors') {
    const body = await readJson(request)
    if (!body.name) return json({ error: '字段缺失：name' }, 400)
    const id = randomId('a')
    await run(env, `
      INSERT INTO authors (
        id, name, avatar_url, bio, guild_name, guild_recruit, guild_contact,
        creator_account_id, visibility, moderation_status, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'approved', 'clean', ?)
    `, [id, body.name, body.avatarUrl ?? null, body.bio ?? null, body.guildName ?? null, body.guildRecruit ?? null, body.guildContact ?? null, nowIso()])
    return json(rowToAuthor(await first(env, 'SELECT * FROM authors WHERE id = ?', [id])), 201)
  }

  if (authorMatch && (method === 'PUT' || method === 'DELETE')) {
    const id = decodeURIComponent(authorMatch[1])
    const row = await first(env, 'SELECT * FROM authors WHERE id = ?', [id])
    if (!row) return json({ error: 'author not found' }, 404)
    if (method === 'DELETE') {
      const count = await first(env, 'SELECT COUNT(*) AS n FROM boards WHERE author_id = ?', [id])
      if (count.n > 0) return json({ error: '该作者名下还有战术板，不能删除' }, 409)
      await run(env, 'DELETE FROM authors WHERE id = ?', [id])
      return json({ ok: true })
    }
    const body = await readJson(request)
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
      if (key in body) {
        if (key === 'visibility' && !['semi_public', 'approved', 'hidden'].includes(body[key])) return json({ error: '字段无效：visibility' }, 400)
        sets.push(`${col} = ?`)
        params.push(body[key] ?? null)
      }
    }
    if (sets.length > 0) {
      params.push(id)
      await run(env, `UPDATE authors SET ${sets.join(', ')} WHERE id = ?`, params)
    }
    return json(rowToAuthor(await first(env, 'SELECT * FROM authors WHERE id = ?', [id])))
  }

  return json({ error: '未找到' }, 404)
}

export default {
  async fetch(request, env) {
    try {
      return withCors(await handle(request, env), request, env)
    } catch (err) {
      console.error(JSON.stringify({ error: err?.message, stack: err?.stack }))
      return withCors(json({ error: '服务异常，请稍后再试' }, 500), request, env)
    }
  },
}
