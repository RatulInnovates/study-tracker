import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { format } from "date-fns";
import { toast } from "sonner";
import { getDb } from "../../db/client";
import { dumpAll, getSettings, setSetting } from "../../db/settings";
import { isoDay, replan } from "../../db/today";
import { MAX_PER_DAY } from "../../domain/scheduler";
import { PageHeader } from "../../ui/PageHeader";
import { AiSettings } from "./AiSettings";
import { RoadmapImport } from "./RoadmapImport";
import { FONT_MAX, FONT_MIN, applyFontScale, applyTheme } from "./theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const field = "rounded-sm border border-line bg-surface px-2 py-1 text-text";
const btn = "press rounded-sm border border-line bg-raised px-3 py-1.5 text-[13px] disabled:opacity-50";

interface Backups {
  dir: string;
  files: string[];
}

export function SettingsPage() {
  const qc = useQueryClient();
  const { data: s } = useQuery({ queryKey: ["settings"], queryFn: async () => getSettings(await getDb()) });
  const backups = useQuery({ queryKey: ["backups"], queryFn: () => invoke<Backups>("backups") });
  const [busy, setBusy] = useState(false);

  const days = (s?.study_days ?? "1,2,3,4,5").split(",").filter(Boolean).map(Number);
  const fontScale = Number(s?.font_scale) || 100;
  const perDay = Number(s?.sessions_per_day) || 2;

  /** Saves one key; plan-affecting keys also rebuild the schedule from today. */
  async function saveSetting(key: string, value: string, rescheduling = true) {
    try {
      const db = await getDb();
      await setSetting(db, key, value);
      if (rescheduling) await replan(db, isoDay());
      await qc.invalidateQueries();
    } catch (e) {
      toast.error(`Could not save: ${e}`);
    }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  const stamp = () => format(new Date(), "yyyy-MM-dd-HHmm");
  const exportDb = () =>
    run(async () => {
      const dest = await save({ defaultPath: `study-tracker-${stamp()}.db`, filters: [{ name: "SQLite", extensions: ["db"] }] });
      if (!dest) return;
      await (await getDb()).execute("VACUUM INTO ?", [dest]);
      toast.success("Database exported");
    });
  const exportJson = () =>
    run(async () => {
      const dest = await save({ defaultPath: `study-tracker-${stamp()}.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
      if (!dest) return;
      await invoke("write_text", { path: dest, contents: JSON.stringify(await dumpAll(await getDb()), null, 2) });
      toast.success("JSON exported");
    });
  const importDb = () =>
    run(async () => {
      const src = await open({ defaultPath: backups.data?.dir, filters: [{ name: "SQLite", extensions: ["db"] }] });
      if (!src) return;
      if (!window.confirm("Replace ALL current data with this backup? The app restarts. Current data is saved first in the backups folder.")) return;
      const info = await invoke<Backups>("backups");
      await (await getDb()).execute("VACUUM INTO ?", [`${info.dir}\\before-restore-${stamp()}.db`]);
      await invoke("stage_restore", { src });
      await invoke("restart_app");
    });

  return (
    <>
      <PageHeader title="Settings" subtitle="Plan, appearance and backups" />
      <div className="max-w-2xl space-y-8 px-8 py-6">
        <section aria-labelledby="plan" className="space-y-3">
          <h2 id="plan" className="font-semibold">Plan</h2>
          <label className="flex items-center justify-between gap-4">
            Target end date
            <input type="date" className={field} value={s?.target_end_date ?? ""} onChange={(e) => saveSetting("target_end_date", e.target.value)} />
          </label>
          <label className="flex items-center justify-between gap-4">
            Sessions per day (when no end date)
            <input
              type="number" min={1} max={MAX_PER_DAY} className={`${field} w-20`} value={perDay}
              onChange={(e) => saveSetting("sessions_per_day", String(Math.min(MAX_PER_DAY, Math.max(1, Number(e.target.value) || 1))))}
            />
          </label>
          <fieldset className="flex items-center justify-between gap-4">
            <legend className="sr-only">Study days</legend>
            <span>Study days</span>
            <div className="flex gap-1">
              {DAYS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <button
                    key={d} type="button" aria-pressed={on}
                    // keep at least one day, otherwise the scheduler has nowhere to put sessions
                    onClick={() => !(on && days.length === 1) && saveSetting("study_days", (on ? days.filter((x) => x !== i) : [...days, i]).sort().join(","))}
                    className={`press rounded-sm border px-2 py-1 text-[12px] ${on ? "border-accent bg-accent text-accent-fg" : "border-line text-muted"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </section>

        <section aria-labelledby="look" className="space-y-3">
          <h2 id="look" className="font-semibold">Appearance</h2>
          <label className="flex items-center justify-between gap-4">
            Theme
            <select
              className={field} value={s?.theme ?? "dark"}
              onChange={(e) => { applyTheme(e.target.value); saveSetting("theme", e.target.value, false); }}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </label>
          <div className="flex items-center justify-between gap-4">
            <span id="font-label">Text size</span>
            <div role="group" aria-labelledby="font-label" className="flex items-center gap-2">
              <button
                className={btn} aria-label="Decrease text size" disabled={fontScale <= FONT_MIN}
                onClick={() => { applyFontScale(String(fontScale - 10)); saveSetting("font_scale", String(fontScale - 10), false); }}
              >
                A−
              </button>
              <span className="w-12 text-center tabular-nums" aria-live="polite">{fontScale}%</span>
              <button
                className={btn} aria-label="Increase text size" disabled={fontScale >= FONT_MAX}
                onClick={() => { applyFontScale(String(fontScale + 10)); saveSetting("font_scale", String(fontScale + 10), false); }}
              >
                A+
              </button>
            </div>
          </div>
        </section>

        <section aria-labelledby="roadmap" className="space-y-3">
          <h2 id="roadmap" className="font-semibold">Roadmap</h2>
          <p className="text-muted">Current: <span className="text-text">{s?.roadmap_name ?? "none"}</span></p>
          <RoadmapImport hasProgress onLoaded={() => qc.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "boot" })} />
        </section>

        <section aria-labelledby="ai" className="space-y-3">
          <h2 id="ai" className="font-semibold">AI features</h2>
          <AiSettings />
        </section>

        <section aria-labelledby="backup" className="space-y-3">
          <h2 id="backup" className="font-semibold">Backup</h2>
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={busy} onClick={exportDb}>Export database</button>
            <button className={btn} disabled={busy} onClick={exportJson}>Export JSON</button>
            <button className={btn} disabled={busy} onClick={importDb}>Import database…</button>
          </div>
          <p className="text-muted">A backup is taken automatically once a day on launch; the newest 7 are kept.</p>
          {backups.data && (
            <div className="rounded-md border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="min-w-0 truncate font-mono text-[12px] text-muted" title={backups.data.dir}>{backups.data.dir}</code>
                <button className={btn} onClick={() => revealItemInDir(backups.data.dir).catch((e) => toast.error(String(e)))}>Open folder</button>
              </div>
              <ul className="mt-2 space-y-0.5 font-mono text-[12px]">
                {backups.data.files.length === 0 && <li className="text-muted">No backups yet.</li>}
                {backups.data.files.map((f) => <li key={f} className="truncate">{f}</li>)}
              </ul>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
