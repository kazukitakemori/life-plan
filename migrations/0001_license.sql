CREATE TABLE IF NOT EXISTS license_keys (
  id TEXT PRIMARY KEY,
  key_hash TEXT NOT NULL UNIQUE,
  key_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  max_devices INTEGER NOT NULL DEFAULT 2,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS license_devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_label TEXT,
  activated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(license_id, device_id),
  FOREIGN KEY (license_id) REFERENCES license_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_license_devices_license ON license_devices(license_id);
