import { addDays, format, parseISO } from "date-fns";

export interface PlanSession {
  id: number;
  kind: "study" | "project";
}
export interface PlanOpts {
  from: string; // YYYY-MM-DD, first day that may receive sessions
  studyDays: number[]; // 0=Sun..6=Sat
  perDay: number; // study sessions per day; each day also fits one project (micro-build) session
}

export const MAX_PER_DAY = 3;
const iso = (d: Date) => format(d, "yyyy-MM-dd");
const clamp = (n: number) => Math.min(MAX_PER_DAY, Math.max(1, n));

/** Study sessions per day needed to finish by `end`, capped at MAX_PER_DAY. */
export function paceFor(remainingStudy: number, from: string, end: string, studyDays: number[]): number {
  let days = 0;
  for (let d = parseISO(from); iso(d) <= end; d = addDays(d, 1)) if (studyDays.includes(d.getDay())) days++;
  return clamp(days ? Math.ceil(remainingStudy / days) : MAX_PER_DAY);
}

/** Rolling plan: lays the remaining sessions out in roadmap order from `from`; never produces past dates. */
export function schedule(sessions: PlanSession[], { from, studyDays, perDay }: PlanOpts): { id: number; date: string }[] {
  if (!studyDays.length) throw new Error("studyDays must not be empty");
  const out: { id: number; date: string }[] = [];
  let day = parseISO(from);
  let study = 0;
  let project = 0;
  for (const s of sessions) {
    while (!studyDays.includes(day.getDay()) || (s.kind === "project" ? project >= 1 : study >= clamp(perDay))) {
      day = addDays(day, 1);
      [study, project] = [0, 0];
    }
    s.kind === "project" ? project++ : study++;
    out.push({ id: s.id, date: iso(day) });
  }
  return out;
}

/** Consecutive study days with at least one completion, ending today (today may still be pending) or yesterday. */
export function streak(doneDates: string[], today: string, studyDays: number[]): number {
  const done = new Set(doneDates);
  let n = 0;
  let d = parseISO(today);
  for (let i = 0; i < 3650; i++, d = addDays(d, -1)) {
    if (done.has(iso(d))) n++;
    else if (i > 0 && studyDays.includes(d.getDay())) break;
  }
  return n;
}
