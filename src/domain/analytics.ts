import { addDays, differenceInCalendarDays, format, startOfWeek } from "date-fns";

export interface AreaSignals {
  quiz: number | null; // avg quiz score 0-100
  review: number | null; // % of reviews that passed
  retention: number | null; // % of card reviews not rated Again
  lastActive: string | null; // ISO date or datetime
}

const WEIGHTS = { quiz: 0.4, review: 0.3, retention: 0.3 };

/** 0-100, or null with no evidence. Weighted mean of what exists, discounted up to 40% as the area goes stale (7 to 60 days). */
export function readiness(s: AreaSignals, today: string): number | null {
  const parts = (Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).filter((k) => s[k] !== null);
  if (!parts.length) return null;
  const w = parts.reduce((a, k) => a + WEIGHTS[k], 0);
  const base = parts.reduce((a, k) => a + (s[k] as number) * WEIGHTS[k], 0) / w;
  const age = s.lastActive ? differenceInCalendarDays(today, s.lastActive.slice(0, 10)) : 60;
  const decay = 1 - 0.4 * Math.min(1, Math.max(0, (age - 7) / 53));
  return Math.round(base * decay);
}

/** Lowest readiness among areas that have any evidence. */
export const weakest = <T extends { readiness: number | null }>(areas: T[]) =>
  areas.filter((a) => a.readiness !== null).sort((a, b) => a.readiness! - b.readiness!)[0];

/** Sessions completed per week for the last `weeks` weeks (Monday start), oldest first. */
export function weeklyVelocity(completed: string[], today: string, weeks = 8) {
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, i) => {
    const start = format(addDays(monday, (i - weeks + 1) * 7), "yyyy-MM-dd");
    const end = format(addDays(start, 7), "yyyy-MM-dd");
    return { week: start, done: completed.filter((c) => c.slice(0, 10) >= start && c.slice(0, 10) < end).length };
  });
}

/** Positive = projected finish is later than the target. */
export const daysBehind = (finish: string | null, target: string | null) =>
  finish && target ? differenceInCalendarDays(finish, target) : null;
