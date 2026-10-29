import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Trash2, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getDb } from "../../db/client";
import { isoDay } from "../../db/today";
import {
  addBenchmark,
  benchmarksFor,
  deleteBenchmark,
  dodFor,
  listProjects,
  setDod,
  setProjectField,
  type ProjectRow,
  type ProjectStatus,
} from "../../db/projects";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";
import { ProgressRing } from "../../ui/ProgressRing";

const STATUS: Record<ProjectStatus, string> = { not_started: "Not started", in_progress: "In progress", shipped: "Shipped" };
const field = "w-full rounded-sm border border-line bg-bg px-2 py-1.5";
const isWeb = (u: string) => /^https?:\/\//i.test(u.trim());

function TextField({ project, name, label, link }: { project: ProjectRow; name: "repo_path" | "remote_url" | "demo_url"; label: string; link?: boolean }) {
  const qc = useQueryClient();
  const [v, setV] = useState(project[name] ?? "");
  const save = async () => {
    if (v.trim() === (project[name] ?? "")) return;
    await setProjectField(await getDb(), project.id, name, v);
    qc.invalidateQueries({ queryKey: ["projects"] });
  };
  return (
    <label className="block">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="flex items-center gap-1">
        <input value={v} onChange={(e) => setV(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={`${field} num`} />
        {link && isWeb(v) && (
          <button type="button" aria-label={`Open ${label}`} onClick={() => openUrl(v.trim())} className="press shrink-0 rounded-sm p-1.5 text-muted hover:text-text">
            <ExternalLink size={14} aria-hidden />
          </button>
        )}
      </span>
    </label>
  );
}

function Benchmarks({ projectId }: { projectId: number }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["benchmarks", projectId], queryFn: async () => benchmarksFor(await getDb(), projectId) });
  const [metric, setMetric] = useState("");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["benchmarks", projectId] });
  const num = Number(value);
  const valid = metric.trim() !== "" && value.trim() !== "" && Number.isFinite(num);
  const add = async () => {
    if (!valid) return;
    await addBenchmark(await getDb(), projectId, { metric, value: num, unit, run_at: isoDay() });
    setMetric("");
    setValue("");
    setUnit("");
    refresh();
  };
  return (
    <section>
      <h3 className="mb-2 font-medium">Benchmarks</h3>
      {data.length === 0 ? (
        <p className="mb-2 text-muted">No runs logged yet.</p>
      ) : (
        <table className="mb-2 w-full table-fixed text-left">
          <tbody>
            {data.map((b) => (
              <tr key={b.id} className="border-b border-line">
                <td className="truncate py-1.5 pr-2" title={b.metric}>{b.metric}</td>
                <td className="num w-28 truncate pr-2 text-right" title={`${b.value} ${b.unit}`}>{b.value} {b.unit}</td>
                <td className="num w-24 text-[12px] text-muted">{b.run_at}</td>
                <td className="w-6">
                  <button aria-label={`Delete ${b.metric} run`} onClick={async () => (await deleteBenchmark(await getDb(), b.id), refresh())} className="press text-muted hover:text-danger">
                    <Trash2 size={13} aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form onSubmit={(e) => (e.preventDefault(), add())} className="flex gap-1">
        <input aria-label="Metric" placeholder="metric" value={metric} onChange={(e) => setMetric(e.target.value)} className={`${field} min-w-0 flex-1`} />
        <input aria-label="Value" placeholder="value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={`${field} num w-20`} />
        <input aria-label="Unit" placeholder="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={`${field} w-16`} />
        <button disabled={!valid} className="press rounded-sm bg-accent px-3 text-accent-fg disabled:opacity-40">Add</button>
      </form>
    </section>
  );
}

function Detail({ p, onClose }: { p: ProjectRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: dod = [] } = useQuery({ queryKey: ["dod", p.id], queryFn: async () => dodFor(await getDb(), p.id) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["projects"] });
  return (
    <aside className="w-[420px] shrink-0 space-y-5 overflow-y-auto border-l border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[12px] text-muted">L{p.level_num} capstone</p>
          <h2 className="break-words text-[16px] font-semibold">{p.title}</h2>
        </div>
        <button aria-label="Close" onClick={onClose} className="press text-muted hover:text-text">
          <X size={16} aria-hidden />
        </button>
      </div>
      {p.result && <p className="text-muted">{p.result}</p>}
      <label className="block">
        <span className="text-[12px] text-muted">Status</span>
        <select
          value={p.status}
          onChange={async (e) => (await setProjectField(await getDb(), p.id, "status", e.target.value), refresh())}
          className={field}
        >
          {Object.entries(STATUS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      <TextField project={p} name="repo_path" label="Repo path" />
      <TextField project={p} name="remote_url" label="Remote URL" link />
      <TextField project={p} name="demo_url" label="Demo link" link />
      <section>
        <h3 className="mb-2 font-medium">Definition of done <span className="num text-muted">{p.dod_done}/{p.dod_total}</span></h3>
        {dod.length === 0 && <p className="text-muted">No checklist items.</p>}
        <ul className="space-y-1">
          {dod.map((d) => (
            <li key={d.id}>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={!!d.done}
                  onChange={async (e) => {
                    await setDod(await getDb(), d.id, e.target.checked);
                    qc.invalidateQueries({ queryKey: ["dod", p.id] });
                    refresh();
                  }}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span className={`min-w-0 break-words ${d.done ? "text-muted line-through" : ""}`}>{d.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
      <Benchmarks projectId={p.id} />
    </aside>
  );
}

export function Projects() {
  const [openId, setOpenId] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ["projects"], queryFn: async () => listProjects(await getDb()) });
  const open = data?.find((p) => p.id === openId);
  const shipped = data?.filter((p) => p.status === "shipped").length ?? 0;

  return (
    <div className="flex h-full" onKeyDown={(e) => e.key === "Escape" && setOpenId(null)}>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <PageHeader title="Projects" subtitle={data ? `${shipped} of ${data.length} capstones shipped` : undefined} />
        {data && data.length === 0 ? (
          <EmptyState title="No capstones found" hint="The roadmap seed has not been loaded." />
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-8">
            {data?.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setOpenId(p.id)}
                  aria-pressed={p.id === openId}
                  className={`press flex h-full w-full items-start gap-3 rounded-md border border-line p-3 text-left hover:bg-raised ${p.id === openId ? "bg-raised" : "bg-surface"}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] text-muted">L{p.level_num} · {STATUS[p.status]}</span>
                    <span className="line-clamp-2 break-words font-medium" title={p.title}>{p.title}</span>
                    <span className="num mt-1 block truncate text-[12px] text-muted" title={p.repo_path ?? undefined}>{p.repo_path || "no repo linked"}</span>
                  </span>
                  <ProgressRing value={p.dod_total ? p.dod_done / p.dod_total : 0} label={`${p.dod_done} of ${p.dod_total} done`} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && <Detail key={open.id} p={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
