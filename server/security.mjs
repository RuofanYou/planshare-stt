const DEFAULT_ALLOWED_ORIGINS = [
  'https://zhaobanzi.pages.dev',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export function parseAllowedOrigins(value) {
  const origins = new Set(DEFAULT_ALLOWED_ORIGINS)
  for (const item of String(value ?? '').split(',')) {
    const origin = item.trim()
    if (origin) origins.add(origin)
  }
  return origins
}

export function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return true
  return allowedOrigins.has(origin)
}

export function createFixedWindowLimiter({ limit, windowMs, now = Date.now }) {
  const buckets = new Map()

  function hit(key) {
    const time = now()
    const current = buckets.get(key)
    if (!current || current.resetAt <= time) {
      const next = { count: 1, resetAt: time + windowMs }
      buckets.set(key, next)
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: next.resetAt }
    }

    current.count += 1
    return {
      allowed: current.count <= limit,
      remaining: Math.max(0, limit - current.count),
      resetAt: current.resetAt,
    }
  }

  function reset(key) {
    buckets.delete(key)
  }

  function sweep() {
    const time = now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= time) buckets.delete(key)
    }
  }

  return { hit, reset, sweep }
}

export function createViewDeduper({ windowMs, now = Date.now }) {
  const seen = new Map()

  function shouldCount(clientKey, boardId) {
    const key = `${clientKey}:${boardId}`
    const time = now()
    const expiresAt = seen.get(key)
    if (expiresAt && expiresAt > time) return false
    seen.set(key, time + windowMs)
    return true
  }

  function sweep() {
    const time = now()
    for (const [key, expiresAt] of seen) {
      if (expiresAt <= time) seen.delete(key)
    }
  }

  return { shouldCount, sweep }
}

export function getClientKey(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string' && realIp.trim()) return realIp.trim()
  return req.ip || req.socket?.remoteAddress || 'unknown'
}

export function assertSafeAdminPassword({ password, host, nodeEnv }) {
  const isPublicHost = host !== '127.0.0.1' && host !== 'localhost'
  const isProduction = nodeEnv === 'production' || isPublicHost
  if (!isProduction) return password || 'planshare-admin'
  if (!password || password === 'planshare-admin') {
    throw new Error('生产环境必须设置非默认 ADMIN_PASSWORD')
  }
  return password
}
