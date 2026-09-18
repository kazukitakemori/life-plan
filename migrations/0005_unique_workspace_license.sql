PRAGMA foreign_keys = ON;

-- One workspace may be linked to only one redeemed utilization code.
-- This keeps revoke/reactivate semantics unambiguous and prevents two
-- different codes from becoming competing entitlement sources.
CREATE UNIQUE INDEX IF NOT EXISTS idx_license_keys_redeemed_workspace_unique
  ON license_keys(redeemed_workspace_id)
  WHERE redeemed_workspace_id IS NOT NULL;
