PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  picture_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES account_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_sessions_user_id
  ON account_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_sessions_expires_at
  ON account_sessions(expires_at);

CREATE TABLE IF NOT EXISTS account_plans (
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, plan_id),
  FOREIGN KEY (user_id) REFERENCES account_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_plans_user_updated
  ON account_plans(user_id, updated_at DESC);
