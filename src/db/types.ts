/** The one seam between app code and SQLite. Tauri implements it at runtime, node:sqlite in tests. */
export interface Db {
  execute(sql: string, params?: unknown[]): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}
