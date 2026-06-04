CREATE TABLE IF NOT EXISTS raids (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  patch TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bosses (
  id TEXT PRIMARY KEY,
  raid_id TEXT NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS authors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  guild_name TEXT,
  guild_recruit TEXT,
  guild_contact TEXT,
  creator_account_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'approved',
  moderation_status TEXT NOT NULL DEFAULT 'clean',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS boards (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raid_id TEXT NOT NULL,
  boss_id TEXT,
  difficulty TEXT NOT NULL,
  season_version TEXT NOT NULL,
  content_text TEXT NOT NULL,
  import_code TEXT,
  description TEXT NOT NULL,
  author_id TEXT NOT NULL,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  is_featured INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  raid_id TEXT NOT NULL,
  boss_id TEXT,
  difficulty TEXT NOT NULL,
  season_version TEXT NOT NULL,
  description TEXT NOT NULL,
  content_text TEXT NOT NULL,
  submitter_name TEXT NOT NULL,
  contact TEXT,
  wants_creator_profile INTEGER NOT NULL DEFAULT 0,
  creator_avatar_url TEXT,
  creator_bio TEXT,
  creator_guild_name TEXT,
  creator_guild_recruit TEXT,
  creator_guild_contact TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source_key TEXT,
  review_note TEXT,
  board_id TEXT,
  author_id TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS creator_accounts (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  email_verified_at TEXT,
  password_hash TEXT,
  status TEXT NOT NULL,
  author_id TEXT,
  contact TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS creator_email_tokens (
  id TEXT PRIMARY KEY,
  creator_account_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS creator_sessions (
  id TEXT PRIMARY KEY,
  creator_account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT,
  revoked_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_accounts_username_unique ON creator_accounts(username);
CREATE INDEX IF NOT EXISTS idx_creator_sessions_account_id ON creator_sessions(creator_account_id);
