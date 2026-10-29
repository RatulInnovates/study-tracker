import Database from "@tauri-apps/plugin-sql";
import type { Db } from "./types";

let db: Promise<Db> | undefined;

export function getDb(): Promise<Db> {
  db ??= Database.load("sqlite:study-tracker.db").then((d) => ({
    execute: async (sql, params = []) => void (await d.execute(sql, params)),
    select: (sql, params = []) => d.select(sql, params),
  }));
  return db;
}
