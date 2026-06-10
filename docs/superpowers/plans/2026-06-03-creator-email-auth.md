# Creator Email Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a lightweight creator email activation and password-login system that replaces the visible WeChat login MVP while keeping board publication behind admin review.

**Architecture:** Keep Fastify + SQLite as the single backend authority. Extend `authors` as the public creator-profile SSOT, add `creator_accounts` and `creator_email_tokens` for login, and expose creator auth/profile APIs consumed by the existing React Query client. Mail delivery is a single abstraction with `log` mode as the deploy-safe default.

**Tech Stack:** Fastify, better-sqlite3, Node test runner, React, Vite, TypeScript, React Query.

---

## File Structure

- Modify `server/index.mjs`: schema, statements, creator email routes, author visibility filtering, submission application flow, admin binding.
- Create `server/creator-email-auth.test.mjs`: red-green tests for application, activation, login, profile edit, visibility, approval binding, rejection/spam.
- Modify `src/data/types.ts`: add creator email account/profile/session DTOs and submission email field.
- Modify `src/api/client.ts`: add creator email auth/profile APIs and remove visible WeChat usage.
- Modify `src/api/hooks.ts`: add login, activate, profile update, resend, forgot/reset hooks.
- Modify `src/pages/Submit.tsx` and `src/pages/Submit.css`: require email when applying as creator and explain activation.
- Modify `src/pages/Creator.tsx` and `src/pages/Creator.css`: replace WeChat card with email/password login and creator console profile editor.
- Create `src/pages/CreatorActivate.tsx` and `src/pages/CreatorActivate.css`: activation/password setup page.
- Modify router file `src/App.tsx`: add `/creator/activate`.
- Modify `DEPLOY.md`: document mail environment variables.
- Modify `scripts/remote-data.mjs`: include new account/token/author visibility fields for backups.

## Task 1: Backend Email Account Core

**Files:**
- Create: `server/creator-email-auth.test.mjs`
- Modify: `server/index.mjs`

- [ ] **Step 1: Write failing tests**

Add tests that start a temporary server and assert:

```js
test('creator application immediately creates pending email account and logs activation link', async (t) => {
  const server = await startServer({ MAIL_PROVIDER: 'log', FRONTEND_BASE_URL: 'https://front.example' })
  t.after(() => server.stop())

  const { res, body } = await requestJson(server.baseUrl, '/api/submissions', {
    method: 'POST',
    body: JSON.stringify(validCreatorSubmission({ contact: 'creator@example.com' })),
  })

  assert.equal(res.status, 201)
  assert.equal(body.contact, 'creator@example.com')
  assert.ok(server.output().includes('/creator/activate?token='))
})

test('creator activation consumes token and returns a creator session', async (t) => {
  const server = await startServer({ MAIL_PROVIDER: 'log', FRONTEND_BASE_URL: 'https://front.example' })
  t.after(() => server.stop())
  await submitCreatorApplication(server, 'creator@example.com')
  const token = activationTokenFromOutput(server.output())

  const { res, body } = await requestJson(server.baseUrl, '/api/creator/activate', {
    method: 'POST',
    body: JSON.stringify({ token, password: 'creator-password-123' }),
  })

  assert.equal(res.status, 200)
  assert.ok(body.token)
  assert.equal(body.user.email, 'creator@example.com')
  assert.equal(body.user.status, 'active')
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test server/creator-email-auth.test.mjs`

Expected: FAIL because `/api/creator/activate` does not exist and submission does not create activation mail.

- [ ] **Step 3: Implement minimal backend core**

In `server/index.mjs`:

- add `creator_accounts`
- add `creator_email_tokens`
- extend `authors` with `creator_account_id`, `visibility`, `moderation_status`, `updated_at`
- implement `createEmailToken`, `hashEmailToken`, `sendActivationEmail`
- implement `POST /api/creator/activate`
- update `POST /api/submissions` to require email for creator applications, create/reuse account, create/reuse author draft, insert submission with `author_id`, and log activation link

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test server/creator-email-auth.test.mjs`

Expected: PASS for Task 1 tests.

## Task 2: Creator Login, Me, Password Reset

**Files:**
- Modify: `server/creator-email-auth.test.mjs`
- Modify: `server/index.mjs`

- [ ] **Step 1: Write failing tests**

Add tests:

```js
test('creator can log in with email and password after activation', async (t) => {
  const server = await startServer({ MAIL_PROVIDER: 'log' })
  t.after(() => server.stop())
  await activateCreator(server, 'creator@example.com', 'creator-password-123')

  const { res, body } = await requestJson(server.baseUrl, '/api/creator/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'creator@example.com', password: 'creator-password-123' }),
  })

  assert.equal(res.status, 200)
  assert.ok(body.token)
  const me = await requestJson(server.baseUrl, '/api/creator/me', {
    headers: { Authorization: `Bearer ${body.token}` },
  })
  assert.equal(me.res.status, 200)
  assert.equal(me.body.user.email, 'creator@example.com')
})

test('forgot password returns neutral response and reset token can set a new password', async (t) => {
  const server = await startServer({ MAIL_PROVIDER: 'log', FRONTEND_BASE_URL: 'https://front.example' })
  t.after(() => server.stop())
  await activateCreator(server, 'creator@example.com', 'creator-password-123')

  const forgot = await requestJson(server.baseUrl, '/api/creator/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: 'creator@example.com' }),
  })
  assert.equal(forgot.res.status, 200)
  const token = resetTokenFromOutput(server.output())

  const reset = await requestJson(server.baseUrl, '/api/creator/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password: 'new-password-123' }),
  })
  assert.equal(reset.res.status, 200)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test server/creator-email-auth.test.mjs`

Expected: FAIL because login/reset routes are missing.

- [ ] **Step 3: Implement minimal backend routes**

In `server/index.mjs`:

- add password hashing and verification using Node `crypto.scryptSync`
- add `POST /api/creator/login`
- add `POST /api/creator/resend-activation`
- add `POST /api/creator/forgot-password`
- add `POST /api/creator/reset-password`
- update `GET /api/creator/me` to return email-account fields and author visibility

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test server/creator-email-auth.test.mjs`

Expected: PASS for Task 1 and Task 2 tests.

## Task 3: Profile Editing, Visibility, Admin Review

**Files:**
- Modify: `server/creator-email-auth.test.mjs`
- Modify: `server/index.mjs`

- [ ] **Step 1: Write failing tests**

Add tests:

```js
test('activated creator can edit semi-public author profile before board approval', async (t) => {
  const server = await startServer({ MAIL_PROVIDER: 'log' })
  t.after(() => server.stop())
  const creatorToken = await activateCreator(server, 'creator@example.com', 'creator-password-123')

  const update = await requestJson(server.baseUrl, '/api/creator/profile', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${creatorToken}` },
    body: JSON.stringify({ bio: 'M团战术作者', guildName: '星界开荒团' }),
  })

  assert.equal(update.res.status, 200)
  assert.equal(update.body.author.bio, 'M团战术作者')
  assert.equal(update.body.author.visibility, 'semi_public')
})

test('admin approval promotes creator author and publishes board', async (t) => {
  const server = await startServer({ MAIL_PROVIDER: 'log' })
  t.after(() => server.stop())
  const creatorToken = await activateCreator(server, 'creator@example.com', 'creator-password-123')
  await submitLoggedCreatorBoard(server, creatorToken)
  const admin = await adminToken(server.baseUrl)
  const [submission] = await adminSubmissions(server.baseUrl, admin)

  const approve = await requestJson(server.baseUrl, `/api/admin/submissions/${submission.id}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${admin}` },
    body: JSON.stringify({ mode: 'createAuthor' }),
  })

  assert.equal(approve.res.status, 200)
  assert.equal(approve.body.author.visibility, 'approved')
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test server/creator-email-auth.test.mjs`

Expected: FAIL because profile update and author visibility promotion are missing.

- [ ] **Step 3: Implement profile/admin behavior**

In `server/index.mjs`:

- add `PUT /api/creator/profile`
- validate profile fields and block obvious unsafe terms
- update `rowToAuthor`/admin author shape to include visibility fields where needed
- ensure approved submissions promote linked author to `approved`
- ensure rejected submissions leave account active and do not publish board
- ensure spam can hide author/account when requested

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test server/creator-email-auth.test.mjs`

Expected: PASS for all creator email backend tests.

## Task 4: Frontend Types, API, Hooks

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/api/client.ts`
- Modify: `src/api/hooks.ts`
- Modify: `src/api/creatorAuth.ts`

- [ ] **Step 1: Run build to capture current baseline**

Run: `npm run build`

Expected: PASS before frontend changes.

- [ ] **Step 2: Implement API contracts**

Add typed functions:

- `creatorLogin`
- `creatorActivate`
- `creatorResendActivation`
- `creatorForgotPassword`
- `creatorResetPassword`
- `updateCreatorProfile`

Update `CreatorUser` from WeChat fields to email-account fields while preserving local token storage.

- [ ] **Step 3: Run TypeScript build**

Run: `npm run build`

Expected: FAIL only if later UI still calls removed WeChat API.

## Task 5: Submit and Creator UI

**Files:**
- Modify: `src/pages/Submit.tsx`
- Modify: `src/pages/Submit.css`
- Modify: `src/pages/Creator.tsx`
- Modify: `src/pages/Creator.css`
- Create: `src/pages/CreatorActivate.tsx`
- Create: `src/pages/CreatorActivate.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace visible WeChat login**

`/creator` unauthenticated state becomes email/password login with resend and forgot-password actions.

- [ ] **Step 2: Add activation page**

`/creator/activate` reads token from query string, lets the creator set password, stores session token, and redirects to `/creator`.

- [ ] **Step 3: Update submit creator fields**

When creator application is selected, require email, keep profile fields, and show copy that activation email is sent immediately while board review remains separate.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: PASS.

## Task 6: Data Backup, Docs, Full Verification

**Files:**
- Modify: `scripts/remote-data.mjs`
- Modify: `DEPLOY.md`

- [ ] **Step 1: Add backup/import support**

Include `creator_accounts`, `creator_email_tokens`, and new `authors` columns in remote export/import flow. Exclude consumed/expired raw tokens because only hashes are stored.

- [ ] **Step 2: Document env vars**

Document:

- `MAIL_PROVIDER`
- `MAIL_FROM`
- `SMTP_*` or future provider credentials
- `FRONTEND_BASE_URL`

- [ ] **Step 3: Run full verification**

Run:

```sh
npm test
npm run build
```

Expected: both PASS.

- [ ] **Step 4: Commit implementation**

Run:

```sh
git status --short
git add server src scripts DEPLOY.md docs/superpowers/plans/2026-06-03-creator-email-auth.md
git commit -m "feat: add creator email authentication"
```

Expected: commit succeeds with only PlanShare files.

