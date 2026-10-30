import { format } from "date-fns";
import { MAX_PER_DAY, paceFor, schedule } from "../domain/scheduler";
import type { Db } from "./types";

export interface SessionRow {
  id: number;
  module_id: number;
  title: string;
  kind: "study" | "project";
  est_minutes: number;
  status: "todo" | "done" | "skipped";
  scheduled_date: string | null;
  level_num: number;
}
export interface Topic {
  id: number;
  label: string;
  detail: string;
  done: number;
}

export const isoDay = (d = new Date()) => format(d, "yyyy-MM-dd");

export async function loadPlan(db: Db) {
  const rows = await db.select<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key IN ('study_days', 'sessions_per_day', 'target_end_date')");
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const days = (s.study_days ?? "1,2,3,4,5").split(",").map(Number).filter((n) => n >= 0 && n <= 6);
  return {
    studyDays: days.length ? days : [1, 2, 3, 4, 5],
    perDay: Math.min(MAX_PER_DAY, Math.max(1, Number(s.sessions_per_day) || 2)),
    endDate: s.target_end_date || null,
  };
}

/** Rolling reschedule: only `todo` sessions move; done ones keep their history. */
export async function replan(db: Db, from: string) {
  const plan = await loadPlan(db);
  const todo = await db.select<{ id: number; kind: "study" | "project" }>("SELECT id, kind FROM sessions WHERE status = 'todo' ORDER BY seq");
  const perDay = plan.endDate ? paceFor(todo.filter((s) => s.kind === "study").length, from, plan.endDate, plan.studyDays) : plan.perDay;
  for (const a of schedule(todo, { from, studyDays: plan.studyDays, perDay }))
    await db.execute("UPDATE sessions SET scheduled_date = ? WHERE id = ?", [a.date, a.id]);
}

const SESSION_SQL = `SELECT s.id, s.module_id, s.title, s.kind, s.est_minutes, s.status, s.scheduled_date, l.num level_num
  FROM sessions s JOIN modules m ON m.id = s.module_id JOIN levels l ON l.id = m.level_id`;

export const sessionsOn = (db: Db, date: string) => db.select<SessionRow>(`${SESSION_SQL} WHERE s.scheduled_date = ? ORDER BY s.seq`, [date]);

export async function planStats(db: Db, today: string) {
  const [r] = await db.select<{ overdue: number; unscheduled: number; finish: string | null; remaining: number; total: number }>(
    `SELECT
       (SELECT COUNT(*) FROM sessions WHERE status = 'todo' AND scheduled_date < ?) overdue,
       (SELECT COUNT(*) FROM sessions WHERE status = 'todo' AND scheduled_date IS NULL) unscheduled,
       (SELECT MAX(scheduled_date) FROM sessions WHERE status = 'todo') finish,
       (SELECT COUNT(*) FROM sessions WHERE status = 'todo') remaining,
       (SELECT COUNT(*) FROM sessions) total`,
    [today],
  );
  return r;
}

export const upcoming = (db: Db, date: string, n = 5) =>
  db.select<SessionRow>(`${SESSION_SQL} WHERE s.status = 'todo' AND s.scheduled_date > ? ORDER BY s.seq LIMIT ?`, [date, n]);

export async function doneDates(db: Db) {
  return (await db.select<{ d: string }>("SELECT DISTINCT substr(completed_at, 1, 10) d FROM sessions WHERE completed_at IS NOT NULL")).map((r) => r.d);
}

export const setDone = (db: Db, id: number, done: boolean) =>
  db.execute("UPDATE sessions SET status = ?, completed_at = ? WHERE id = ?", [done ? "done" : "todo", done ? format(new Date(), "yyyy-MM-dd'T'HH:mm:ss") : null, id]);

/** "Pull tomorrow's session": brings the next unfinished session onto `date`. */
export const pullNext = (db: Db, date: string) =>
  db.execute(
    "UPDATE sessions SET scheduled_date = ? WHERE id = (SELECT id FROM sessions WHERE status = 'todo' AND (scheduled_date IS NULL OR scheduled_date > ?) ORDER BY seq LIMIT 1)",
    [date, date],
  );

export const topicsFor = (db: Db, moduleId: number) => db.select<Topic>("SELECT id, label, detail, done FROM topics WHERE module_id = ? ORDER BY seq", [moduleId]);
export const setTopic = (db: Db, id: number, done: boolean) => db.execute("UPDATE topics SET done = ? WHERE id = ?", [done ? 1 : 0, id]);

export async function getNote(db: Db, sessionId: number) {
  return (await db.select<{ body: string }>("SELECT body FROM session_notes WHERE session_id = ?", [sessionId]))[0]?.body ?? "";
}
export const saveNote = (db: Db, sessionId: number, body: string) =>
  db.execute(
    "INSERT INTO session_notes (session_id, body, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(session_id) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at",
    [sessionId, body],
  );

export async function focusSeconds(db: Db, sessionId: number) {
  return (await db.select<{ n: number }>("SELECT COALESCE(SUM(seconds), 0) n FROM focus_logs WHERE session_id = ?", [sessionId]))[0].n;
}
export const logFocus = (db: Db, sessionId: number, startedAt: number, seconds: number) =>
  db.execute("INSERT INTO focus_logs (session_id, started_at, seconds) VALUES (?, ?, ?)", [sessionId, new Date(startedAt).toISOString(), seconds]);
