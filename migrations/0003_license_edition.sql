ALTER TABLE license_keys ADD COLUMN edition TEXT NOT NULL DEFAULT 'personal'
  CHECK (edition IN ('personal', 'advisor'));
