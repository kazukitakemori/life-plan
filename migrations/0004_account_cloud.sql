PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS account_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  picture_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_subject TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (provider, provider_subject),
  FOREIGN KEY (user_id) REFERENCES account_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_identities_user_id
  ON account_identities(user_id);

CREATE TABLE IF NOT EXISTS account_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES account_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_sessions_user_id
  ON account_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_account_sessions_expires_at
  ON account_sessions(expires_at);

CREATE TABLE IF NOT EXISTS account_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'personal'
    CHECK (kind IN ('personal', 'advisor')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS account_workspace_members (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner'
    CHECK (role IN ('owner', 'member')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES account_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES account_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_workspace_members_user_id
  ON account_workspace_members(user_id);

CREATE TABLE IF NOT EXISTS account_entitlements (
  workspace_id TEXT PRIMARY KEY,
  edition TEXT NOT NULL DEFAULT 'personal'
    CHECK (edition IN ('personal', 'advisor')),
  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'inactive')),
  trial_analysis_used INTEGER NOT NULL DEFAULT 0
    CHECK (trial_analysis_used IN (0, 1)),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES account_workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account_plans (
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  document_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, plan_id),
  FOREIGN KEY (workspace_id) REFERENCES account_workspaces(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_plans_workspace_updated
  ON account_plans(workspace_id, updated_at DESC);

-- Existing license keys become one-time account entitlement codes instead of
-- browser/device registrations. A key can be linked to only one workspace.
ALTER TABLE license_keys ADD COLUMN redeemed_workspace_id TEXT;
ALTER TABLE license_keys ADD COLUMN redeemed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_license_keys_redeemed_workspace_id
  ON license_keys(redeemed_workspace_id);
