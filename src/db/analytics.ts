import { weeklyVelocity, readiness, type AreaSignals } from "../domain/analytics";
import type { Db } from "./types";

interface Agg { area: string; v: number | null; last: string | null }

/** Readiness per level, joining quiz attempts, project reviews and card reviews (cards use the level title as area). */
export async function areaReadiness(db: Db, today: string) {
  const levels = await db.select<{ num: number; title: string }>("SELECT num, title FROM levels ORDER BY num");
  const [quiz, review, cards] = await Promise.all([
    db.select<Agg>(`SELECT l.title area, AVG(a.score) v, MAX(a.taken_at) last FROM quiz_attempts a
      JOIN quizzes q ON q.id = a.quiz_id JOIN sessions s ON s.id = q.session_id JOIN modules m ON m.id = s.module_id JOIN levels l ON l.id = m.level_id GROUP BY l.id`),
    db.select<Agg>(`SELECT l.title area, 100.0 * AVG(r.verdict = 'pass') v, MAX(r.created_at) last FROM reviews r
      JOIN projects p ON p.id = r.target_id JOIN levels l ON l.id = p.level_id WHERE r.target_type = 'project' GROUP BY l.id`),
    db.select<Agg>(`SELECT c.area, 100.0 * AVG(cr.rating > 1) v, MAX(cr.reviewed_at) last FROM card_reviews cr JOIN cards c ON c.id = cr.card_id GROUP BY c.area`),
  ]);
  const by = (rows: Agg[]) => new Map(rows.map((r) => [r.area, r]));
  const [q, r, c] = [by(quiz), by(review), by(cards)];
  return levels.map((l) => {
    const sig: AreaSignals = {
      quiz: q.get(l.title)?.v ?? null,
      review: r.get(l.title)?.v ?? null,
      retention: c.get(l.title)?.v ?? null,
      lastActive: [q, r, c].map((m) => m.get(l.title)?.last ?? "").sort().pop() || null,
    };
    return { ...l, ...sig, readiness: readiness(sig, today) };
  });
}

/** Focus hours per level, split by session kind (study = theory, project = hands-on). */
export const hoursByLevel = (db: Db) =>
  db.select<{ num: number; title: string; study: number; project: number }>(
    `SELECT l.num, l.title,
       COALESCE(SUM(CASE WHEN s.kind = 'study' THEN f.seconds END), 0) / 3600.0 study,
       COALESCE(SUM(CASE WHEN s.kind = 'project' THEN f.seconds END), 0) / 3600.0 project
     FROM levels l LEFT JOIN modules m ON m.level_id = l.id LEFT JOIN sessions s ON s.module_id = m.id LEFT JOIN focus_logs f ON f.session_id = s.id
     GROUP BY l.id ORDER BY l.num`,
  );

export async function velocity(db: Db, today: string, weeks = 8) {
  const rows = await db.select<{ c: string }>("SELECT completed_at c FROM sessions WHERE status = 'done' AND completed_at IS NOT NULL");
  return weeklyVelocity(rows.map((r) => r.c), today, weeks);
}
