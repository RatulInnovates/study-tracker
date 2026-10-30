import { invoke } from "@tauri-apps/api/core";
import { getSettings } from "../../db/settings";
import type { Db } from "../../db/types";

export const applyTheme = (t?: string) => document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");

export const FONT_MIN = 80;
export const FONT_MAX = 150;
// shortcut: zoom scales the whole UI (px sizes included), not only text; split into a font-size token if that matters.
export const applyFontScale = (pct?: string) => {
  const n = Math.min(FONT_MAX, Math.max(FONT_MIN, Number(pct) || 100));
  document.documentElement.style.zoom = String(n / 100);
};

/** Applies the saved theme and takes the daily `auto-YYYY-MM-DD.db` snapshot (VACUUM INTO is WAL-safe). Never blocks boot on failure. */
export async function bootSettings(db: Db) {
  const saved = await getSettings(db);
  applyTheme(saved.theme);
  applyFontScale(saved.font_scale);
  try {
    const name = `auto-${new Date().toLocaleDateString("sv")}.db`;
    const info = await invoke<{ dir: string; files: string[] }>("backups");
    if (!info.files.includes(name)) await db.execute("VACUUM INTO ?", [`${info.dir}/${name}`]);
    await invoke("backups"); // prunes to the newest 7 auto-backups
  } catch (e) {
    console.error("auto-backup failed", e);
  }
}
