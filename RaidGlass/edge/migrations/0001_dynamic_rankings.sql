CREATE TABLE IF NOT EXISTS ranking_targets (
    target_key TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('spec', 'comp')),
    boss_slug TEXT NOT NULL,
    spec_slug TEXT,
    role TEXT,
    difficulty TEXT,
    metric TEXT,
    ranking_json TEXT,
    refresh_status TEXT NOT NULL CHECK (refresh_status IN ('fresh', 'stale')),
    checked_at TEXT NOT NULL,
    published_at TEXT,
    upstream_updated TEXT,
    last_error_code TEXT,
    last_run_id TEXT NOT NULL,
    CHECK (
        (kind = 'comp' AND spec_slug IS NULL AND role IS NULL AND difficulty IS NULL AND metric IS NULL)
        OR
        (kind = 'spec' AND spec_slug IS NOT NULL AND role IS NOT NULL AND difficulty IS NOT NULL AND metric IS NOT NULL)
    )
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS global_status (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
