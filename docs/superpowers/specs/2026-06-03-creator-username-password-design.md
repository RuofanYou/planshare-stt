# PlanShare Creator Username Password Auth Design

Date: 2026-06-03
Status: Approved approach, pending implementation planning
Supersedes: `docs/superpowers/specs/2026-06-03-creator-email-auth-design.md`

## Goal

PlanShare will replace the creator email activation MVP with a simpler username and password creator account system.

The product goal is lower friction:

- Users can apply to become creators while submitting a board.
- Registration must not depend on email delivery, domains, SMTP, Resend, Mailjet, WeChat, QQ, or other third-party auth platforms.
- Creator accounts become usable immediately after registration.
- Creator profile pages can be managed immediately after registration.
- Boards still require admin approval before broad public distribution.

This design keeps the current Fastify + SQLite backend as the only auth authority.

## Chosen Approach

Use approach A: create the creator account inside the creator application flow on `/submit`.

When a visitor selects "申请创作者", the submission form collects:

- login username
- login password
- public creator display name
- optional creator profile fields
- board submission content

On successful submission, the backend creates the account, creates or binds the author profile, stores the board submission as pending, and returns a creator session token. The user can then open `/creator` and manage the profile immediately.

This avoids a separate registration funnel and keeps the creator application tied to a real board contribution.

## Non-Goals

The MVP will not include:

- email verification
- email password reset
- true outbound email delivery
- WeChat login
- QQ login
- phone number login
- SMS verification
- captcha
- OAuth providers
- paid auth SaaS

Forgotten passwords are handled manually by an admin in this phase. The UI should say this plainly instead of pretending that email reset exists.

## Core States

There are two separate state axes.

### Creator Account State

Controls login eligibility:

- `active`: account can log in.
- `suspended`: account cannot log in.

There is no `pending_email` state. Account creation and password setup happen in the same request.

### Creator Profile Visibility

Controls author homepage exposure:

- `semi_public`: profile has a direct page and can be found by exact or intentional search.
- `approved`: profile has stronger public exposure after admin trust is established.
- `hidden`: admin has hidden the profile.

Newly registered creator profiles start as `semi_public`, unless the account is later suspended or the profile is hidden by admin action.

Board publication remains separate:

- `pending`
- `approved`
- `rejected`
- `spam`

Only approved boards appear in broad public board discovery.

## User Flow

### Creator Application Through `/submit`

The `/submit` page remains the MVP creator registration entry.

When "申请创作者" is selected, the form requires:

- username
- password
- public display name
- board title
- raid
- boss
- difficulty
- board content

The form may also collect optional public profile fields:

- bio
- guild name
- guild contact
- guild recruitment copy
- avatar URL if the existing UI already supports it

The old "登录邮箱" copy is removed. Any contact field is renamed to optional "联系方式" and is not used for login.

On success:

- the account is active immediately
- the author profile is created as `semi_public`
- the board submission is created as `pending`
- the response includes a creator session token
- the frontend can either auto-login or show a direct "进入创作者后台" action

The preferred UX is auto-login after successful creator application, because the user has just set a password.

### Creator Login

`/creator` shows:

- username input
- password input
- login button

It does not show:

- email activation
- resend activation email
- forgot password email

Forgot password copy:

> 忘记密码请联系管理员重置。

### Creator Console

After login, the creator console shows:

- username
- public display name
- profile visibility
- profile edit form
- link to the public or semi-public author page
- guidance that board publication still requires review

Activated creators can update their own author profile. They cannot approve or publish boards.

### Admin Review

The admin submission review queue remains the publication gate.

For creator submissions, admin can:

- approve the board and publish it
- reject the board without disabling the account
- mark the board as spam
- hide the author profile if profile content is abusive
- suspend the creator account if the account is abusive

Admin approval of a board can promote the author profile from `semi_public` to `approved`.

## Backend Design

### Tables

Reuse the current `creator_accounts` table with a username-first model.

Target logical fields:

- `id TEXT PRIMARY KEY`
- `username TEXT NOT NULL UNIQUE`
- `password_hash TEXT NOT NULL`
- `status TEXT NOT NULL`
- `author_id TEXT`
- `contact TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `last_login_at TEXT`

The previous email fields can remain physically present during migration, but new runtime code must not depend on them:

- `email`
- `email_verified_at`

The previous `creator_email_tokens` table can remain physically present during migration, but no runtime route should read or write it.

Reuse `authors` as the single source of truth for creator profile data.

Relevant fields:

- `creator_account_id TEXT`
- `visibility TEXT NOT NULL`
- `moderation_status TEXT NOT NULL`
- `updated_at TEXT`

### Username Rules

Usernames must be:

- 3 to 24 characters
- lowercase letters, numbers, `_`, or `-`
- unique case-insensitively by normalizing to lowercase before storage

Reserved names are rejected:

- `admin`
- `root`
- `api`
- `creator`
- `submit`
- `author`
- `authors`
- `board`
- `boards`
- `login`
- `register`
- `zhaobanzi`

### Password Rules

Passwords must be:

- at least 8 characters
- stored only as a slow hash
- never returned through APIs
- never logged

The existing Node crypto password hashing approach is acceptable for the MVP if it already uses `scrypt`. Do not add a new dependency unless the current implementation is insufficient.

### API

#### `POST /api/creator/login`

Request:

```json
{
  "username": "rofantank",
  "password": "password123"
}
```

Response:

```json
{
  "token": "...",
  "user": {
    "id": "ca-...",
    "username": "rofantank",
    "status": "active",
    "authorId": "a-..."
  },
  "author": {}
}
```

#### `GET /api/creator/me`

Uses the creator bearer token and returns the current creator account plus bound author profile.

#### `PUT /api/creator/profile`

Allows the logged-in creator to update only their own author profile fields.

Allowed fields:

- display name
- avatar URL
- bio
- guild name
- guild contact
- guild recruitment copy

The creator cannot edit:

- profile visibility
- moderation status
- board approval state
- another author's profile

#### `POST /api/submissions`

For normal submissions, behavior remains unchanged.

For creator applications from unauthenticated users, request body includes:

```json
{
  "wantsCreatorProfile": true,
  "creatorUsername": "rofantank",
  "creatorPassword": "password123",
  "submitterName": "Rofan",
  "contact": "QQ or BattleTag, optional"
}
```

Backend transaction:

1. validate submission fields
2. validate username and password
3. create creator account
4. create author profile as `semi_public`
5. bind account to author
6. create pending submission with `author_id`
7. return the submission plus creator session data

If username already exists, return `409` with a clear message.

For logged-in creators, submissions use the existing creator token and do not ask for username or password again.

### Removed Runtime Routes

The following routes should be removed or return 404:

- `POST /api/creator/activate`
- `POST /api/creator/resend-activation`
- `POST /api/creator/forgot-password`
- `POST /api/creator/reset-password`
- `GET /api/creator/auth-capabilities`

WeChat auth routes should remain absent.

## Frontend Design

### `/submit`

When "申请创作者" is selected:

- replace "登录邮箱" with "用户名"
- add password input
- keep public display name through the existing submitter name field
- keep optional public profile fields
- clarify that the account is created immediately, while board publication still requires review

On success:

- if creator session data is returned, store token in the existing creator session storage
- show "账号已创建，投稿已进入审核"
- show a primary action to open `/creator`

### `/creator`

Replace the current email-login UI with username/password login.

Remove:

- "重发激活邮件"
- "忘记密码" email reset
- copy saying an activation email was sent

Add:

- forgot-password note telling the user to contact admin
- profile visibility status
- board review reminder

### Types and Hooks

Update frontend DTOs from email account naming to creator account naming.

Examples:

- `CreatorUser.email` becomes optional or is replaced by `username`
- `creatorLogin(email, password)` becomes `creatorLogin(username, password)`
- activation/reset hooks are deleted
- submission response can include `creatorAuth` or equivalent session payload

## Migration

Because the current email auth MVP has minimal real usage, the migration can be simple:

1. Add username/contact columns if missing.
2. Stop using email token routes.
3. For existing test accounts, either leave them unusable or give them generated usernames in a one-time migration path.
4. Preserve existing `authors` and `submissions` data.
5. Do not physically drop old email columns or token table during this change.

The important rule is runtime behavior, not schema cleanup. Old columns can be removed later after the username system has been stable.

## Error Handling

Use clear, user-facing errors:

- username missing: `请填写用户名`
- username format invalid: `用户名只能包含小写英文、数字、下划线或短横线`
- username taken: `这个用户名已被占用`
- password too short: `密码至少需要 8 位`
- login failed: `用户名或密码错误`
- suspended: `账号已被暂停，请联系管理员`
- rate limited: `操作太频繁，请稍后再试`

Do not reveal whether a username exists during login failure.

## Abuse Controls

MVP controls:

- registration/submission rate limit by client key
- login rate limit by client key
- admin suspend account
- admin hide profile
- board review before broad public exposure
- field length limits
- plain text rendering only, no raw HTML

Captcha is intentionally deferred until there is real abuse.

## Testing

Backend tests should cover:

- creator application creates active account and semi-public author profile
- creator application returns a session token
- duplicate username returns `409`
- login succeeds with username and password
- login fails with wrong password
- suspended account cannot log in
- creator can edit only their own profile
- board remains pending after account registration
- admin approval promotes board and can promote author profile
- removed email routes return 404
- legacy WeChat routes remain 404

Frontend build must pass after deleting email activation/reset hooks and pages.

## Deployment

No new third-party environment variables are required.

Remove or mark obsolete:

- `MAIL_PROVIDER`
- `MAIL_FROM`
- any documented Resend, Mailjet, SMTP, or email token setup

Keep:

- `ADMIN_PASSWORD`
- existing CloudBase and Cloudflare deployment commands

## Acceptance Criteria

The feature is complete when:

- a visitor can apply as creator from `/submit` with username and password
- the account is usable immediately after submission
- the creator can open `/creator` and manage their profile
- the submitted board remains pending until admin approval
- no UI promises email delivery
- no runtime code depends on email activation tokens
- legacy WeChat login remains absent
- tests and production build pass
