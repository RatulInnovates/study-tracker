import { invoke } from "@tauri-apps/api/core";
import { getSettings } from "../../db/settings";
import type { Db } from "../../db/types";

export const applyTheme = (t?: string) => document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");

/** Applies the saved theme and takes the daily `auto-YYYY-MM-DD.db` snapshot (VACUUM INTO is WAL-safe). Never blocks boot on failure. */
export async function bootSettings(db: Db) {
  applyTheme((await getSettings(db)).theme);
  try {
    const name = `auto-${new Date().toLocaleDateString("sv")}.db`;
    const info = await invoke<{ dir: string; files: string[] }>("backups");
    if (!info.files.includes(name)) await db.execute("VACUUM INTO ?", [`${info.dir}\\${name}`]);
    await invoke("backups"); // prunes to the newest 7 auto-backups
  } catch (e) {
    console.error("auto-backup failed", e);
  }
}
