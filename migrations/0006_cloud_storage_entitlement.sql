PRAGMA foreign_keys = ON;

-- Authentication and paid feature rights are separate from cloud storage rights.
-- Personal buy-once users keep plan documents in the browser by default.
-- Advisor users keep cloud storage enabled as the standard offering.
ALTER TABLE account_entitlements
  ADD COLUMN cloud_storage_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (cloud_storage_enabled IN (0, 1));

ALTER TABLE license_keys
  ADD COLUMN cloud_storage_enabled INTEGER NOT NULL DEFAULT 0
    CHECK (cloud_storage_enabled IN (0, 1));

UPDATE account_entitlements
SET cloud_storage_enabled = 1
WHERE edition = 'advisor';

UPDATE license_keys
SET cloud_storage_enabled = 1
WHERE edition = 'advisor';

DROP TRIGGER IF EXISTS trg_license_activate_account_entitlement;

CREATE TRIGGER trg_license_activate_account_entitlement
AFTER UPDATE OF status ON license_keys
WHEN NEW.status = 'active' AND NEW.redeemed_workspace_id IS NOT NULL
BEGIN
  UPDATE account_entitlements
  SET status = 'active',
      edition = COALESCE(NEW.edition, edition),
      cloud_storage_enabled = COALESCE(NEW.cloud_storage_enabled, cloud_storage_enabled),
      updated_at = CURRENT_TIMESTAMP
  WHERE workspace_id = NEW.redeemed_workspace_id;
END;
