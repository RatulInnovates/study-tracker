// Test-only Db backed by Node's built-in SQLite.
import { DatabaseSync } from "node:sqlite";
import type { Db } from "./types";

export function memoryDb(): Db {
  const d = new DatabaseSync(":memory:");
  d.exec("PRAGMA foreign_keys = ON");
  return {
    execute: async (sql, params = []) => void d.prepare(sql).run(...(params as never[])),
    select: async <T,>(sql: string, params: unknown[] = []) => d.prepare(sql).all(...(params as never[])) as T[],
  };
}
