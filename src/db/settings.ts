import type { Db } from "./types";

export async function getSettings(db: Db) {
  return Object.fromEntries((await db.select<{ key: string; value: string }>("SELECT key, value FROM settings")).map((r) => [r.key, r.value]));
}

export const setSetting = (db: Db, key: string, value: string) =>
  db.execute("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);

/** Every user table as {table: rows}. Table names come from sqlite_master, never from input. */
export async function dumpAll(db: Db) {
  const tables = await db.select<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
  const out: Record<string, unknown[]> = {};
  for (const t of tables) out[t.name] = await db.select(`SELECT * FROM "${t.name}"`);
  return out;
}
