CREATE TABLE IF NOT EXISTS wcl_samples (
    sample_key TEXT PRIMARY KEY,
    report_code TEXT NOT NULL,
    fight_id INTEGER NOT NULL,
    source_id INTEGER NOT NULL,
    fight_start REAL NOT NULL,
    fight_duration REAL NOT NULL,
    cursor REAL,
    complete INTEGER NOT NULL DEFAULT 0 CHECK (complete IN (0, 1)),
    casts_json TEXT NOT NULL DEFAULT '[]',
    spells_json TEXT NOT NULL DEFAULT '{}',
    queued_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    retry_at TEXT NOT NULL,
    last_error TEXT
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS wcl_samples_pending ON wcl_samples(complete, retry_at, queued_at);
