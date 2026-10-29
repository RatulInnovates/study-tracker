import type { Db } from "./types";

// Vite inlines every NNN_name.sql at build time; keys look like "./migrations/001_core.sql".
const files = import.meta.glob("./migrations/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const versionOf = (path: string) => Number(path.match(/\/(\d+)_[^/]+\.sql$/)?.[1]);

/** Applies unapplied migrations in numeric order. Statements are split on `;` at line end, so no `;` inside string literals or triggers. */
export async function migrate(db: Db, migrations: Record<string, string> = files): Promise<number[]> {
  await db.execute("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  const done = new Set((await db.select<{ version: number }>("SELECT version FROM schema_migrations")).map((r) => r.version));
  const all = Object.entries(migrations).map(([path, sql]) => ({ version: versionOf(path), sql }));
  if (all.some((m) => !Number.isInteger(m.version))) throw new Error("migration file name must start with NNN_");
  const pending = all.filter((m) => !done.has(m.version)).sort((a, b) => a.version - b.version);
  for (const m of pending) {
    for (const stmt of m.sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await db.execute(stmt);
    await db.execute("INSERT INTO schema_migrations (version, applied_at) VALUES (?, datetime('now'))", [m.version]);
  }
  return pending.map((m) => m.version);
}
