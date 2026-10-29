import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { getDb } from "../../db/client";
import { replaceRoadmap } from "../../db/roadmapImport";
import { bundledRoadmap } from "../../db/seed";
import { parseRoadmap, roadmapCounts, ROADMAP_PROMPT, type RoadmapData } from "../../domain/roadmapFile";

const btn = "press rounded-sm border border-line bg-raised px-3 py-1.5 text-[13px] disabled:opacity-50";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Pick a roadmap JSON file (or restore the bundled one), see what it contains, then load it.
 * `hasProgress` = a roadmap is already loaded, so replacing it needs a confirmation and a safety backup first.
 */
export function RoadmapImport({ hasProgress, onLoaded }: { hasProgress: boolean; onLoaded: () => void }) {
  const file = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ data: RoadmapData; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(f: File | undefined) {
    setParsed(null);
    setError(null);
    if (!f) return;
    try {
      setParsed({ data: parseRoadmap(await f.text()), name: f.name });
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function load(data: RoadmapData) {
    if (hasProgress && !window.confirm(`Replace the current roadmap with "${data.name}"? All progress, notes, quizzes, cards and reviews tied to the current roadmap are deleted. A backup is saved first in the backups folder.`)) return;
    setBusy(true);
    try {
      const db = await getDb();
      if (hasProgress) {
        const info = await invoke<{ dir: string }>("backups");
        await db.execute("VACUUM INTO ?", [`${info.dir}\\before-import-${new Date().toISOString().replace(/[:.]/g, "-")}.db`]);
      }
      await replaceRoadmap(db, data);
      toast.success(`Loaded "${data.name}"`);
      onLoaded();
    } catch (e) {
      toast.error(`Import failed: ${errMsg(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const c = parsed && roadmapCounts(parsed.data);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button className={btn} disabled={busy} onClick={() => file.current?.click()}>Choose roadmap file…</button>
        <button
          className={`${btn} flex items-center gap-2`}
          onClick={() => navigator.clipboard.writeText(ROADMAP_PROMPT).then(() => toast.success("Prompt copied. Paste it into Claude or any AI chat."), (e) => toast.error(errMsg(e)))}
        >
          <Copy size={14} aria-hidden />Copy AI prompt for making one
        </button>
        <button className={btn} disabled={busy} onClick={() => load(bundledRoadmap())}>Use the AI Engineer Roadmap 2026</button>
        <input ref={file} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ""))} />
      </div>
      {error && <p role="alert" className="num whitespace-pre-wrap break-words text-danger">{error}</p>}
      {parsed && c && (
        <div className="rounded-md border border-line bg-surface p-3">
          <p className="font-medium">{parsed.data.name}</p>
          <p className="text-muted">{c.levels} levels · {c.modules} modules · {c.sessions} sessions · {c.projects} projects <span className="num">({parsed.name})</span></p>
          <button className={`${btn} mt-2 bg-accent text-accent-fg`} disabled={busy} onClick={() => load(parsed.data)}>Load this roadmap</button>
        </div>
      )}
      <details className="text-muted">
        <summary className="cursor-pointer">How to make a roadmap file</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Click "Copy AI prompt" and paste it into Claude (or any AI chat).</li>
          <li>Replace the bracketed part with what you want to learn, your level and your timeframe.</li>
          <li>Save the reply as a <code className="num">.json</code> file and choose it here. Mistakes are reported with the exact field.</li>
        </ol>
      </details>
    </div>
  );
}
