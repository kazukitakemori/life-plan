PRAGMA foreign_keys = ON;

-- Keep a server-side deletion marker so legacy/local browser copies cannot
-- recreate a plan after it was intentionally deleted from cloud storage.
CREATE TABLE IF NOT EXISTS account_plan_tombstones (
  workspace_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, plan_id),
  FOREIGN KEY (workspace_id) REFERENCES account_workspaces(id) ON DELETE CASCADE
);

CREATE TRIGGER IF NOT EXISTS trg_account_plan_delete_tombstone
AFTER DELETE ON account_plans
BEGIN
  INSERT INTO account_plan_tombstones (workspace_id, plan_id, deleted_at)
  VALUES (OLD.workspace_id, OLD.plan_id, CURRENT_TIMESTAMP)
  ON CONFLICT(workspace_id, plan_id)
  DO UPDATE SET deleted_at = excluded.deleted_at;
END;
