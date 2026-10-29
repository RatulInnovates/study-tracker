import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getDb } from "../../db/client";
import { areaReadiness, hoursByLevel, velocity } from "../../db/analytics";
import { isoDay, loadPlan, planStats } from "../../db/today";
import { daysBehind, weakest } from "../../domain/analytics";
import { PageHeader } from "../../ui/PageHeader";

const card = "rounded-md border border-line bg-surface p-4";
const h2 = "mb-3 text-[13px] font-medium text-muted";

function Bar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full rounded-sm bg-raised" role="presentation">
      <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

export function Analytics() {
  const today = isoDay();
  const { data } = useQuery({
    queryKey: ["analytics", today],
    queryFn: async () => {
      const db = await getDb();
      const [areas, hours, weeks, plan, stats] = await Promise.all([areaReadiness(db, today), hoursByLevel(db), velocity(db, today), loadPlan(db), planStats(db, today)]);
      return { areas, hours, weeks, plan, stats };
    },
  });
  if (!data) return null;
  const { areas, hours, weeks, plan, stats } = data;
  const weak = weakest(areas);
  const perWeek = plan.perDay * plan.studyDays.length;
  const maxWeek = Math.max(perWeek, ...weeks.map((w) => w.done), 1);
  const maxHours = Math.max(...hours.map((h) => h.study + h.project), 0.01);
  const study = hours.reduce((a, h) => a + h.study, 0);
  const project = hours.reduce((a, h) => a + h.project, 0);
  const behind = daysBehind(stats.finish, plan.endDate);

  return (
    <>
      <PageHeader title="Analytics" subtitle={weak ? `Weakest area: L${weak.num} ${weak.title} (${weak.readiness}%)` : "Take a quiz or review to build readiness scores"} />
      <div className="grid gap-4 p-8 lg:grid-cols-2">
        <section className={`${card} lg:col-span-2`} aria-labelledby="a-ready">
          <h2 id="a-ready" className={h2}>Readiness by level (quizzes 40%, reviews 30%, card retention 30%, discounted when stale)</h2>
          <ul className="space-y-2">
            {areas.map((a) => (
              <li key={a.num} className="grid grid-cols-[minmax(0,1fr)_40px_minmax(80px,1fr)] items-center gap-3">
                <span className="truncate" title={a.title}>L{a.num} {a.title}</span>
                <span className="num text-right text-muted">{a.readiness === null ? "–" : `${a.readiness}%`}</span>
                {a.readiness === null ? <span className="text-[12px] text-muted">no data</span> : <Bar pct={a.readiness} />}
              </li>
            ))}
          </ul>
        </section>

        <section className={card} aria-labelledby="a-vel">
          <h2 id="a-vel" className={h2}>Sessions done per week (plan: {perWeek})</h2>
          <ul className="flex h-32 items-end gap-2">
            {weeks.map((w) => (
              <li key={w.week} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={`Week of ${w.week}: ${w.done}`}>
                <span className="num text-center text-[12px]">{w.done}</span>
                <div className="rounded-sm bg-accent" style={{ height: `${(w.done / maxWeek) * 100}%`, minHeight: w.done ? 2 : 0 }} />
                <span className="num text-center text-[11px] text-muted">{format(w.week, "d/M")}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={card} aria-labelledby="a-burn">
          <h2 id="a-burn" className={h2}>Burndown</h2>
          <dl className="grid grid-cols-2 gap-y-2">
            <dt className="text-muted">Remaining sessions</dt><dd className="num text-right">{stats.remaining}</dd>
            <dt className="text-muted">Overdue</dt><dd className="num text-right">{stats.overdue}</dd>
            <dt className="text-muted">Projected finish</dt><dd className="num text-right">{stats.finish ?? "–"}</dd>
            <dt className="text-muted">Target date</dt><dd className="num text-right">{plan.endDate ?? "not set"}</dd>
          </dl>
          {behind !== null && <p className={`mt-3 ${behind > 0 ? "text-danger" : "text-accent"}`}>{behind > 0 ? `${behind} days behind target` : `${-behind} days ahead of target`}</p>}
        </section>

        <section className={`${card} lg:col-span-2`} aria-labelledby="a-hours">
          <h2 id="a-hours" className={h2}>
            Focus hours: <span className="num">{study.toFixed(1)}h</span> theory · <span className="num">{project.toFixed(1)}h</span> hands-on
            {study + project > 0 && <> ({Math.round((project / (study + project)) * 100)}% hands-on)</>}
          </h2>
          {study + project === 0 ? (
            <p className="text-muted">Use the timer in a session to log focus time.</p>
          ) : (
            <ul className="space-y-1.5">
              {hours.map((h) => (
                <li key={h.num} className="grid grid-cols-[minmax(0,1fr)_56px_minmax(80px,1fr)] items-center gap-3">
                  <span className="truncate" title={h.title}>L{h.num} {h.title}</span>
                  <span className="num text-right text-muted">{(h.study + h.project).toFixed(1)}h</span>
                  <Bar pct={((h.study + h.project) / maxHours) * 100} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
