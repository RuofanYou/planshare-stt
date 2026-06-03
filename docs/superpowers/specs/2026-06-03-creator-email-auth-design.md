# PlanShare Creator Email Auth Design

Date: 2026-06-03
Status: Approved for implementation planning

## Goal

PlanShare will replace the current WeChat-only creator login MVP with a lightweight, self-owned creator email authentication system.

The product model is not open public registration. It is a creator application flow attached to board submission:

- Users can apply to become creators while submitting a board.
- Email activation starts immediately after application submission.
- Admin review must not block account activation.
- Creator profile pages may become semi-public before board approval.
- Boards still require admin approval before they appear in raid, boss, homepage, and broad public discovery surfaces.

## Chosen Approach

Use a lightweight in-project authentication implementation on top of the existing Fastify + SQLite backend.

Do not adopt Better Auth, Auth.js, Supabase Auth, Clerk, or Auth0 for this phase. Those are mature references, but PlanShare's current need is smaller than a full public account system.

This keeps the implementation aligned with KISS:

- One backend service remains authoritative.
- SQLite remains the source of truth.
- Existing submission review and author publishing flows remain intact.
- Email delivery is abstracted behind a single mail provider module so SMTP, Resend, or Tencent SES can be swapped later.

## Source-Backed Constraints

The design follows mature email verification patterns used by authentication systems and security guidance:

- Verification tokens are random, single-use, time-limited, and stored only as hashes.
- Passwords are never stored in plaintext and must use a slow password hash.
- Email verification and password reset share the same token pattern with different purposes.
- Public account information such as name, avatar, and bio still needs moderation and operator controls.

References:

- OWASP Email Validation and Verification Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Email_Validation_and_Verification_Cheat_Sheet.html
- OWASP Forgot Password Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- OWASP Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- Better Auth email/password and email verification docs: https://better-auth.com/docs/concepts/email
- Auth.js email provider and verification-token model: https://authjs.dev/getting-started/authentication/email
- Internet User Account Information Management Provisions: https://www.gov.cn/xinwen/2022-06/28/content_5698178.htm
- Provisions on Ecological Governance of Network Information Content: https://www.gov.cn/zhengce/zhengceku/2020-11/25/content_5564110.htm

## Core State Model

There are three separate state axes.

### Email Account State

Controls login eligibility.

- `pending_email`: account exists, activation email has been sent, password not set.
- `active`: email verified and password set.
- `suspended`: account cannot log in.

Email activation is triggered immediately when a creator application is submitted. It does not wait for admin review.

### Creator Profile State

Controls creator homepage visibility.

- `draft`: profile exists but has not been activated by email yet.
- `semi_public`: email is active; profile has a direct URL and can be found by exact author-name search.
- `approved`: admin has approved at least one creator board/application; profile is a full creator page.
- `hidden`: admin has hidden the profile.

Semi-public profiles are intentionally low-exposure:

- Direct URL works.
- Exact author-name search can find them.
- They do not appear on homepage modules, raid pages, boss pages, featured lists, or broad discovery.

### Board Submission State

Controls board publication.

Existing submission status remains authoritative:

- `pending`
- `approved`
- `rejected`
- `spam`

Only approved boards appear in public raid, boss, homepage, board search, and creator board lists.

## User Flow

### Creator Application Through `/submit`

The current `/submit` page remains the only creator application entry for the MVP.

When "申请创作者" is selected:

- `邮箱` becomes required.
- The old generic "联系方式" field is replaced or specialized as the login email.
- Optional creator profile fields remain available:
  - author name
  - avatar URL
  - bio
  - guild name
  - guild contact
  - guild recruitment copy

On submit success:

- The board enters the normal pending review queue.
- A creator account draft is created or reused by email.
- An author profile row is created or updated as `draft`.
- An activation email is sent immediately.
- The success message tells the user to check email and explains that board publication still requires review.

### Activation

The email link opens:

`/creator/activate?token=...`

The page asks the user to set a password.

On success:

- The token is consumed.
- Email is marked verified.
- Password hash is stored.
- Account state becomes `active`.
- Profile state becomes `semi_public` unless admin has hidden or suspended it.
- The user is logged into `/creator`.

Expired or already used links show a clear recovery action:

- "重新发送激活邮件"

### Creator Login

`/creator` replaces the WeChat login button with:

- email input
- password input
- login button
- "忘记密码"
- "重新发送激活邮件"

After login, the creator console shows:

- email verification status
- profile visibility status
- board submission status
- profile edit form
- link to the semi-public/approved profile page

### Creator Profile Editing

Activated users can edit their profile before admin approval.

Changes can become semi-public immediately, but must pass lightweight guardrails:

- field length limits
- obvious unsafe keyword blocklist
- URL/contact spam limits
- no raw HTML rendering

Admins retain the ability to hide the profile or suspend the account.

### Admin Review

The admin submission review tab remains the primary publishing gate.

For creator applications, admin can:

- approve the board and publish it
- create or bind the public author record
- promote the creator profile to `approved`
- reject the board while leaving the email account active
- mark spam and optionally hide/suspend the creator account

Admin review must not be required for the user to activate email or log in.

## Backend Design

### Tables

Add `creator_accounts`:

- `id TEXT PRIMARY KEY`
- `email TEXT NOT NULL UNIQUE`
- `email_verified_at TEXT`
- `password_hash TEXT`
- `status TEXT NOT NULL`
- `author_id TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `last_login_at TEXT`

Add `creator_email_tokens`:

- `id TEXT PRIMARY KEY`
- `creator_account_id TEXT NOT NULL`
- `purpose TEXT NOT NULL`
- `token_hash TEXT NOT NULL UNIQUE`
- `expires_at TEXT NOT NULL`
- `consumed_at TEXT`
- `created_at TEXT NOT NULL`

Allowed purposes:

- `activate`
- `reset_password`

Extend existing `authors` instead of creating a second public profile table:

- `creator_account_id TEXT UNIQUE`
- `visibility TEXT NOT NULL DEFAULT 'approved'`
- `moderation_status TEXT NOT NULL DEFAULT 'clean'`
- `updated_at TEXT`

Allowed `authors.visibility` values:

- `draft`
- `semi_public`
- `approved`
- `hidden`

`authors` remains the single source of truth for creator profile data. New creator applications create or reuse an `authors` row immediately, with `visibility='draft'` until email activation. After activation, the row becomes `semi_public` unless admin has hidden or suspended it.

Approved boards continue to reference `boards.author_id`. Public discovery endpoints must filter author exposure by visibility:

- homepage, raid, boss, featured, and broad search only include `approved` authors through approved boards
- exact author-name search may include `semi_public` authors
- direct `/author/:authorId` can show `semi_public` and `approved` authors
- `draft` and `hidden` authors are not publicly visible

### API

Public or semi-public:

- `POST /api/submissions`
  - if creator application is requested, requires email
  - creates submission, creator account draft, author profile draft, and activation token

- `POST /api/creator/activate`
  - body: `{ token, password }`
  - verifies token and sets password

- `POST /api/creator/login`
  - body: `{ email, password }`
  - returns creator session token

- `POST /api/creator/resend-activation`
  - body: `{ email }`
  - rate-limited

- `POST /api/creator/forgot-password`
  - body: `{ email }`
  - always returns a neutral success message

- `POST /api/creator/reset-password`
  - body: `{ token, password }`

Creator-authenticated:

- `GET /api/creator/me`
- `PUT /api/creator/profile`
- `GET /api/creator/submissions`

Admin-authenticated:

- `PUT /api/admin/creator-accounts/:id/status`
- `PUT /api/admin/authors/:id/visibility`
- creator account/profile state included in submission review responses

### Mail Provider

Create one mail abstraction:

- `sendActivationEmail({ to, activationUrl })`
- `sendPasswordResetEmail({ to, resetUrl })`

Configuration:

- `MAIL_PROVIDER=log|smtp|resend|tencent_ses`
- `MAIL_FROM`
- provider-specific credentials
- `PUBLIC_FRONTEND_BASE_URL`

For local development and unconfigured production, `MAIL_PROVIDER=log` prints activation/reset links to server logs and returns success. This avoids blocking implementation before DNS and sender configuration are ready.

### Security Rules

- Store only token hashes, never raw email tokens.
- Consume tokens once.
- Expire activation and reset tokens.
- Use slow password hashing.
- Rate-limit login, resend activation, forgot password, and reset password.
- Return neutral responses for forgot-password and resend flows to avoid account enumeration.
- Do not expose email publicly on author pages.
- Do not render profile fields as HTML.

## Frontend Design

### `/submit`

Minimal changes:

- Replace creator "联系方式" with required "邮箱".
- Helper copy explains:
  - email is used for creator login
  - activation email is sent immediately
  - board publication still needs review

### `/creator`

Unauthenticated:

- Email/password login card
- Forgot password link
- Resend activation link

Authenticated:

- status panel
- profile editor
- submission/review status panel
- CTA to public profile URL

### `/creator/activate`

Dedicated activation page:

- token validation handled on submit
- password setup form
- expired-link state with resend action

### Public Author Page

Existing `/author/:authorId` remains the only public creator profile route.

Creator applications create or reuse an `authors` row at application time. Visibility controls whether the page is draft-only, semi-public, approved, or hidden. This avoids a second public profile route and keeps author pages as the single public profile surface.

## Moderation and Risk Controls

The platform will not heavily review creator profile edits before visibility, but it must keep operator controls:

- block obvious unsafe words in display name, bio, guild fields, and contact fields
- limit external links
- allow admin hide profile
- allow admin suspend creator account
- preserve reviewed board gate

This keeps user onboarding fast while avoiding a totally unmanaged public UGC surface.

## Out of Scope for First Implementation

- OAuth providers
- QQ or WeChat login
- fully public user registration
- user comments
- user following
- paid creator features
- complex report center UI
- production-grade email deliverability tuning

## Implementation Acceptance Criteria

- A user can submit a board and apply as creator with email.
- The backend creates a creator account and activation token immediately.
- In log mail mode, the activation link is visible in server logs or response test hooks.
- Activation sets a password and logs the creator in.
- Creator can edit profile before admin approval.
- Semi-public profile is directly visitable and exact-searchable, but not broadly promoted.
- Boards remain hidden until admin approval.
- Admin can approve/reject/spam submissions without blocking email activation.
- Admin can hide/suspend creator profile/account.
- Passwords and email tokens are stored safely.
- Tests cover account creation, activation, login, profile editing, board approval binding, and rejected/spam behavior.
