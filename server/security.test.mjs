import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createFixedWindowLimiter,
  createViewDeduper,
  isOriginAllowed,
  parseAllowedOrigins,
} from './security.mjs'

test('parseAllowedOrigins adds production and local defaults', () => {
  const origins = parseAllowedOrigins('')

  assert.equal(origins.has('https://zhaobanzi.pages.dev'), true)
  assert.equal(origins.has('http://localhost:5173'), true)
  assert.equal(origins.has('http://127.0.0.1:5173'), true)
})

test('parseAllowedOrigins merges env origins and trims blanks', () => {
  const origins = parseAllowedOrigins(' https://foo.example,https://bar.example ,, ')

  assert.equal(origins.has('https://foo.example'), true)
  assert.equal(origins.has('https://bar.example'), true)
  assert.equal(origins.has(''), false)
})

test('isOriginAllowed allows server-to-server requests without Origin', () => {
  const origins = parseAllowedOrigins('')

  assert.equal(isOriginAllowed(undefined, origins), true)
  assert.equal(isOriginAllowed('https://evil.example', origins), false)
  assert.equal(isOriginAllowed('https://zhaobanzi.pages.dev', origins), true)
})

test('createFixedWindowLimiter blocks after the configured limit', () => {
  let now = 1000
  const limiter = createFixedWindowLimiter({
    limit: 2,
    windowMs: 1000,
    now: () => now,
  })

  assert.equal(limiter.hit('ip-a').allowed, true)
  assert.equal(limiter.hit('ip-a').allowed, true)
  assert.equal(limiter.hit('ip-a').allowed, false)

  now = 2100
  assert.equal(limiter.hit('ip-a').allowed, true)
})

test('createFixedWindowLimiter reset clears a blocked key', () => {
  const limiter = createFixedWindowLimiter({
    limit: 1,
    windowMs: 1000,
    now: () => 1000,
  })

  assert.equal(limiter.hit('ip-a').allowed, true)
  assert.equal(limiter.hit('ip-a').allowed, false)
  limiter.reset('ip-a')
  assert.equal(limiter.hit('ip-a').allowed, true)
})

test('createViewDeduper only counts the same client and board once per window', () => {
  let now = 1000
  const deduper = createViewDeduper({
    windowMs: 1000,
    now: () => now,
  })

  assert.equal(deduper.shouldCount('ip-a', 'board-a'), true)
  assert.equal(deduper.shouldCount('ip-a', 'board-a'), false)
  assert.equal(deduper.shouldCount('ip-a', 'board-b'), true)

  now = 2100
  assert.equal(deduper.shouldCount('ip-a', 'board-a'), true)
})
