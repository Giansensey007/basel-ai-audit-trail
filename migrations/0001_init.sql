CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  dossier_id TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  reread_json TEXT,
  reread_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE events (
  session_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  type TEXT NOT NULL,
  canonical_json TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (session_id, seq)
);

CREATE UNIQUE INDEX events_one_decision ON events (session_id) WHERE type = 'decision';
CREATE UNIQUE INDEX events_one_seal ON events (session_id) WHERE type = 'seal';

CREATE TABLE usage (
  bucket TEXT PRIMARY KEY,
  calls INTEGER NOT NULL
);
