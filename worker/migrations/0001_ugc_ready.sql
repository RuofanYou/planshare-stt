ALTER TABLE creator_accounts ADD COLUMN trust_level TEXT NOT NULL DEFAULT 'trusted';
ALTER TABLE creator_accounts ADD COLUMN approved_submission_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE submissions ADD COLUMN content_hash TEXT;
ALTER TABLE submissions ADD COLUMN spam_reason TEXT;

ALTER TABLE boards ADD COLUMN hidden_by TEXT;

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  board_title_snapshot TEXT,
  board_description_snapshot TEXT,
  board_content_snapshot TEXT,
  board_author_id_snapshot TEXT,
  board_updated_at_snapshot TEXT,
  reason TEXT NOT NULL,
  detail TEXT,
  source_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolution_note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at ON rate_limits(reset_at);
CREATE INDEX IF NOT EXISTS idx_submissions_source_content ON submissions(source_key, content_hash);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
