import type Database from "better-sqlite3";

/** Backfill users that have grab rows but no lifetime counters yet (runs once per user). */
export function backfillLifetimeStats(sqlite: Database.Database): void {
  sqlite.exec(`
    UPDATE users SET
      lifetime_grabs = (
        SELECT COUNT(*) FROM grabs WHERE grabs.user_id = users.id
      ),
      lifetime_completed = (
        SELECT COUNT(*) FROM grabs
        WHERE grabs.user_id = users.id AND grabs.status = 'completed'
      ),
      lifetime_bytes = (
        SELECT COALESCE(SUM(COALESCE(grabs.size_bytes, grabs.downloaded_bytes, 0)), 0)
        FROM grabs
        WHERE grabs.user_id = users.id AND grabs.status = 'completed'
      )
    WHERE COALESCE(lifetime_grabs, 0) = 0
      AND (SELECT COUNT(*) FROM grabs WHERE grabs.user_id = users.id) > 0;
  `);
}
