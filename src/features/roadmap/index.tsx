import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import { useSearch } from "wouter";
import { getDb } from "../../db/client";
import { loadRoadmap, type RoadmapSession } from "../../db/roadmap";
import { hasProjectDebt, isFiltering, matches, NO_FILTERS, type Filters } from "../../domain/roadmap";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";
import { SessionDrawer } from "../today/SessionDrawer";

const field = "rounded-sm border border-line bg-surface px-2 py-1.5";

function flip<T>(set: Set<T>, v: T) {
  const next = new Set(set);
  if (!next.delete(v)) next.add(v);
  return next;
}

function Group({ open, onToggle, head, children }: { open: boolean; onToggle: () => void; head: ReactNode; children: ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2 text-left">
        <ChevronRight size={14} aria-hidden className={`shrink-0 text-muted ${open ? "rotate-90" : ""}`} />
        {head}
      </button>
      {open && children}
    </div>
  );
}

function SessionLine({ s, selected, onOpen }: { s: RoadmapSession; selected: boolean; onOpen: () => void }) {
  return (
    <li>
      <button onClick={onOpen} title={s.title} className={`flex w-full items-center gap-3 rounded-sm px-2 py-1.5 text-left hover:bg-raised ${selected ? "bg-raised" : ""}`}>
        <span
          role="img"
          aria-label={s.status}
          className={`h-2 w-2 shrink-0 rounded-full border ${s.status === "done" ? "border-accent bg-accent" : "border-muted"} ${s.status === "skipped" ? "opacity-40" : ""}`}
        />
        <span className={`min-w-0 flex-1 truncate ${s.status === "done" ? "text-muted line-through" : ""}`}>{s.title}</span>
        {s.kind === "project" && <span className="rounded-sm bg-raised px-1.5 text-[12px] text-muted">micro-build</span>}
        <span className="num w-12 text-right text-[12px] text-muted">{s.est_minutes}m</span>
      </button>
    </li>
  );
}

export function Roadmap() {
  const qc = useQueryClient();
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [openLevels, setOpenLevels] = useState<Set<number>>(new Set());
  const [closedPhases, setClosedPhases] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const search = useSearch();
  useEffect(() => {
    const id = Number(new URLSearchParams(search).get("s")); // set by the command palette
    if (id) setOpenId(id);
  }, [search]);
  const { data } = useQuery({ queryKey: ["roadmap"], queryFn: async () => loadRoadmap(await getDb()) });

  const filtering = isFiltering(f);
  const view = useMemo(() => {
    if (!data) return null;
    const byLevel = new Map<number, RoadmapSession[]>();
    for (const s of data.sessions) byLevel.set(s.level_id, [...(byLevel.get(s.level_id) ?? []), s]);
    const highestStarted = Math.max(-1, ...data.sessions.filter((s) => s.status === "done").map((s) => s.level_num));
    const levels = data.levels.map((l) => {
      const all = byLevel.get(l.id) ?? [];
      const done = all.filter((s) => s.status === "done").length;
      const shown = all.filter((s) => matches(s, f));
      return { ...l, all: all.length, done, shown, debt: hasProjectDebt({ num: l.num, unshipped: l.unshipped, total: all.length, done }, highestStarted) };
    });
    const phases = [...new Set(levels.map((l) => l.phase_number))]
      .map((n) => {
        const inPhase = levels.filter((l) => l.phase_number === n);
        return { n, name: inPhase[0].phase_name, levels: inPhase.filter((l) => !filtering || l.shown.length) };
      })
      .filter((p) => p.levels.length);
    return { phases };
  }, [data, f, filtering]);

  const open = data?.sessions.find((s) => s.id === openId);

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <PageHeader
          title="Roadmap"
          subtitle={data ? `${data.levels.length} levels, ${new Set(data.levels.map((l) => l.phase_number)).size} phases, ${data.sessions.length} sessions` : undefined}
        />
        <div className="flex flex-col gap-4 px-8 py-6">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-48 flex-1">
              <Search size={14} aria-hidden className="absolute left-2 top-2.5 text-muted" />
              <input
                type="search"
                aria-label="Search sessions"
                placeholder="Search sessions and modules…"
                value={f.q}
                onChange={(e) => setF({ ...f, q: e.target.value })}
                className={`${field} w-full pl-7`}
              />
            </label>
            <select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Filters["status"] })} className={field}>
              <option value="all">Any status</option>
              <option value="todo">To do</option>
              <option value="done">Done</option>
              <option value="skipped">Skipped</option>
            </select>
            <select aria-label="Kind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Filters["kind"] })} className={field}>
              <option value="all">Any kind</option>
              <option value="study">Study</option>
              <option value="project">Micro-build</option>
            </select>
            <select aria-label="Level" value={f.level ?? ""} onChange={(e) => setF({ ...f, level: e.target.value === "" ? null : Number(e.target.value) })} className={field}>
              <option value="">Any level</option>
              {data?.levels.map((l) => (
                <option key={l.id} value={l.num}>
                  L{l.num}
                </option>
              ))}
            </select>
            {filtering && (
              <button onClick={() => setF(NO_FILTERS)} className="press px-2 py-1.5 text-muted">
                Clear
              </button>
            )}
          </div>

          {view && !view.phases.length && <EmptyState title="No sessions match" hint="Try a different search or clear the filters." />}
          {view?.phases.map((p) => (
            <Group
              key={p.n}
              open={filtering || !closedPhases.has(p.n)}
              onToggle={() => setClosedPhases(flip(closedPhases, p.n))}
              head={
                <span className="text-[12px] font-medium uppercase tracking-wide text-muted">
                  Phase {p.n} · {p.name}
                </span>
              }
            >
              <div className="mt-2 flex flex-col gap-2">
                {p.levels.map((l) => {
                  const modules = new Map<number, RoadmapSession[]>();
                  for (const s of l.shown) modules.set(s.module_id, [...(modules.get(s.module_id) ?? []), s]);
                  return (
                    <div key={l.id} className="rounded-md border border-line bg-surface px-3 py-2.5">
                      <Group
                        open={filtering || openLevels.has(l.id)}
                        onToggle={() => setOpenLevels(flip(openLevels, l.id))}
                        head={
                          <>
                            <span className="num rounded-sm bg-raised px-1.5 text-[12px] text-muted">L{l.num}</span>
                            <span className="min-w-0 flex-1 truncate font-medium" title={l.title}>
                              {l.title}
                            </span>
                            {l.debt && (
                              <span className="rounded-sm bg-raised px-1.5 text-[12px] text-muted" title="A capstone project in this level is not shipped yet">
                                project debt
                              </span>
                            )}
                            <span className="num text-[12px] text-muted">
                              {l.done}/{l.all}
                            </span>
                            <span className="h-1 w-20 shrink-0 overflow-hidden rounded-sm bg-raised" role="img" aria-label={`${l.done} of ${l.all} done`}>
                              <span className="block h-full bg-accent" style={{ width: `${l.all ? (l.done / l.all) * 100 : 0}%` }} />
                            </span>
                          </>
                        }
                      >
                        {l.shown.length === 0 ? (
                          <p className="mt-2 pl-6 text-muted">No sessions in this level.</p>
                        ) : (
                          [...modules.values()].map((ss) => (
                            <div key={ss[0].module_id} className="mt-3 pl-6">
                              <p className="mb-1 truncate text-[12px] text-muted" title={ss[0].module_title}>
                                <span className="num">{ss[0].module_code}</span> · {ss[0].module_title}
                              </p>
                              <ul>
                                {ss.map((s) => (
                                  <SessionLine key={s.id} s={s} selected={s.id === openId} onOpen={() => setOpenId(s.id)} />
                                ))}
                              </ul>
                            </div>
                          ))
                        )}
                      </Group>
                    </div>
                  );
                })}
              </div>
            </Group>
          ))}
        </div>
      </div>
      {open && (
        <SessionDrawer
          key={open.id}
          session={open}
          onClose={() => setOpenId(null)}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["roadmap"] });
            qc.invalidateQueries({ queryKey: ["today"] });
          }}
        />
      )}
    </div>
  );
}
