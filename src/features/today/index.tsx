import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { Flame } from "lucide-react";
import { getDb } from "../../db/client";
import type { Db } from "../../db/types";
import { doneDates, isoDay, loadPlan, planStats, pullNext, replan, sessionsOn, setDone, upcoming, type SessionRow } from "../../db/today";
import { streak } from "../../domain/scheduler";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";
import { ProgressRing } from "../../ui/ProgressRing";
import { SessionDrawer } from "./SessionDrawer";

function Row({ s, selected, onOpen, onToggle }: { s: SessionRow; selected: boolean; onOpen: () => void; onToggle: () => void }) {
  const done = s.status === "done";
  return (
    <li className={`flex items-center gap-3 rounded-md border bg-surface px-3 py-2.5 ${selected ? "border-accent" : "border-line"}`}>
      <input type="checkbox" className="accent-accent" checked={done} onChange={onToggle} aria-label={`Complete: ${s.title}`} />
      <button onClick={onOpen} className={`min-w-0 flex-1 truncate text-left ${done ? "text-muted line-through" : ""}`} title={s.title}>
        {s.title}
      </button>
      <span className="num rounded-sm bg-raised px-1.5 text-[12px] text-muted">L{s.level_num}</span>
      <span className="rounded-sm bg-raised px-1.5 text-[12px] text-muted">{s.kind === "project" ? "micro-build" : "study"}</span>
      <span className="num w-12 text-right text-[12px] text-muted">{s.est_minutes}m</span>
    </li>
  );
}

function Overview({ stats, streak, next }: { stats: { remaining: number; total: number; finish: string | null }; streak: number; next: SessionRow[] }) {
  const done = stats.total - stats.remaining;
  const facts: [string, string][] = [
    ["Done", `${done} / ${stats.total}`],
    ["Remaining", String(stats.remaining)],
    ["Projected finish", stats.finish ? format(parseISO(stats.finish), "MMM d, yyyy") : "-"],
    ["Streak", `${streak} day${streak === 1 ? "" : "s"}`],
  ];
  return (
    <aside aria-label="Overview" className="flex flex-col gap-4">
      <section className="rounded-md border border-line bg-surface p-4">
        <div className="flex items-center gap-4">
          <ProgressRing value={stats.total ? done / stats.total : 0} label={`${done} of ${stats.total} sessions done overall`} />
          <div>
            <p className="num text-[20px] font-semibold">{stats.total ? Math.round((done / stats.total) * 100) : 0}%</p>
            <p className="text-muted">of the roadmap</p>
          </div>
        </div>
        <dl className="mt-4 divide-y divide-line">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted">{k}</dt>
              <dd className="num">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="rounded-md border border-line bg-surface p-4">
        <h2 className="mb-2 font-medium">Coming up</h2>
        {next.length ? (
          <ul className="space-y-2">
            {next.map((n) => (
              <li key={n.id} className="min-w-0">
                <p className="truncate" title={n.title}>{n.title}</p>
                <p className="num text-[12px] text-muted">{n.scheduled_date ? format(parseISO(n.scheduled_date), "EEE, MMM d") : "unscheduled"} · L{n.level_num} · {n.est_minutes}m</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">Nothing queued after today.</p>
        )}
      </section>
    </aside>
  );
}

export function Today() {
  const qc = useQueryClient();
  const today = isoDay();
  const [openId, setOpenId] = useState<number | null>(null);

  const { data } = useQuery({
    queryKey: ["today", today],
    queryFn: async () => {
      const db = await getDb();
      let stats = await planStats(db, today);
      if (stats.unscheduled) {
        await replan(db, today); // first run: lay out the whole roadmap
        stats = await planStats(db, today);
      }
      const plan = await loadPlan(db);
      return { sessions: await sessionsOn(db, today), next: await upcoming(db, today), stats, streak: streak(await doneDates(db), today, plan.studyDays) };
    },
  });

  const run = async (fn: (db: Db) => Promise<unknown>) => {
    await fn(await getDb());
    qc.invalidateQueries({ queryKey: ["today"] });
  };
  const sessions = data?.sessions ?? [];
  const doneCount = sessions.filter((s) => s.status === "done").length;
  const open = sessions.find((s) => s.id === openId);

  return (
    <div className="flex h-full">
      <div className="min-w-0 flex-1 overflow-y-auto">
        <PageHeader
          title="Today"
          subtitle={`${format(new Date(), "EEEE, MMMM d")}${data?.stats.finish ? ` · projected finish ${format(parseISO(data.stats.finish), "MMM d, yyyy")}` : ""}`}
          actions={
            <div className="flex items-center gap-4">
              {!!data?.streak && (
                <span className="num flex items-center gap-1 text-muted" title="Study-day streak">
                  <Flame size={14} aria-hidden /> {data.streak}
                </span>
              )}
              <span className="num text-muted">
                {doneCount}/{sessions.length}
              </span>
              <ProgressRing value={sessions.length ? doneCount / sessions.length : 0} label={`${doneCount} of ${sessions.length} done today`} />
            </div>
          }
        />
        <div className="grid grid-cols-[minmax(0,1fr)_20rem] items-start gap-6 px-8 py-6 max-[1100px]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-3">
          {!!data?.stats.overdue && (
            <div className="flex items-center justify-between gap-3 rounded-md bg-raised px-3 py-2">
              <span>
                {data.stats.overdue} earlier session{data.stats.overdue > 1 ? "s" : ""} slipped. No rush, the plan can shift.
              </span>
              <button className="press rounded-sm border border-line px-2.5 py-1" onClick={() => run((db) => replan(db, today))}>
                Reschedule
              </button>
            </div>
          )}
          {sessions.length ? (
            <ul className="flex flex-col gap-2">
              {sessions.map((s) => (
                <Row key={s.id} s={s} selected={s.id === openId} onOpen={() => setOpenId(s.id)} onToggle={() => run((db) => setDone(db, s.id, s.status !== "done"))} />
              ))}
            </ul>
          ) : data ? (
            <EmptyState
              title={data.stats.remaining ? "Nothing scheduled today" : "Roadmap complete"}
              hint={data.stats.remaining ? "A rest day, or you finished early." : undefined}
            />
          ) : null}
          {!!data?.stats.remaining && (
            <div className="flex gap-2 pt-2">
              <button className="press rounded-sm border border-line px-3 py-1.5" onClick={() => run((db) => pullNext(db, today))}>
                {sessions.length && doneCount === sessions.length ? "Done for today. Pull tomorrow's session" : "Pull next session"}
              </button>
              <button className="press rounded-sm border border-line px-3 py-1.5" onClick={() => run((db) => replan(db, isoDay(addDays(new Date(), 1))))}>
                I missed today
              </button>
            </div>
          )}
        </div>
        {data && <Overview stats={data.stats} streak={data.streak} next={data.next} />}
        </div>
      </div>
      {open && <SessionDrawer key={open.id} session={open} onClose={() => setOpenId(null)} onChanged={() => qc.invalidateQueries({ queryKey: ["today"] })} />}
    </div>
  );
}
