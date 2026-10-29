import type { Db } from "./types";
import roadmap from "../../seed/roadmap.json";

type Stmt = [sql: string, params: unknown[]];

/** Every statement is INSERT OR IGNORE, so a half-finished seed can simply be re-run. */
export function seedStatements(data: typeof roadmap = roadmap): Stmt[] {
  const out: Stmt[] = [];
  const phases = new Map<number, string>();
  let seq = 0;
  for (const l of data.levels) phases.set(l.phase.number, l.phase.name);
  for (const [n, name] of phases) out.push(["INSERT OR IGNORE INTO phases (number, name) VALUES (?, ?)", [n, name]]);

  for (const l of data.levels) {
    out.push(["INSERT OR IGNORE INTO levels (num, phase_id, title, scope) VALUES (?, (SELECT id FROM phases WHERE number = ?), ?, ?)", [l.level, l.phase.number, l.title, l.scope]]);
    for (const m of l.modules) {
      out.push(["INSERT OR IGNORE INTO modules (level_id, code, seq, title, outcome, is_capstone) VALUES ((SELECT id FROM levels WHERE num = ?), ?, ?, ?, ?, ?)", [l.level, m.code, m.seq, m.title, m.outcome, m.isCapstone ? 1 : 0]]);
      m.topics.forEach((t, i) =>
        out.push(["INSERT OR IGNORE INTO topics (module_id, seq, label, detail) VALUES ((SELECT id FROM modules WHERE code = ?), ?, ?, ?)", [m.code, i + 1, t.label, t.detail]]));
      for (let i = 1; i <= m.sessions; i++)
        out.push(["INSERT OR IGNORE INTO sessions (module_id, seq, idx_in_module, title, kind) VALUES ((SELECT id FROM modules WHERE code = ?), ?, ?, ?, ?)",
          [m.code, ++seq, i, m.sessions > 1 ? `${m.title} (${i}/${m.sessions})` : m.title, m.isCapstone ? "project" : "study"]]);
    }
    for (const p of l.projects) {
      out.push(["INSERT OR IGNORE INTO projects (level_id, title, result) VALUES ((SELECT id FROM levels WHERE num = ?), ?, ?)", [l.level, p.title, p.result]]);
      p.checklist.forEach((c, i) =>
        out.push(["INSERT OR IGNORE INTO project_dod_items (project_id, seq, label, detail) VALUES ((SELECT id FROM projects WHERE level_id = (SELECT id FROM levels WHERE num = ?) AND title = ?), ?, ?, ?)", [l.level, p.title, i + 1, c.label, c.detail]]));
    }
  }
  return out;
}

const SEED_VERSION = "1";

export async function seedIfNeeded(db: Db): Promise<boolean> {
  const [row] = await db.select<{ value: string }>("SELECT value FROM settings WHERE key = 'seed_version'");
  if (row?.value === SEED_VERSION) return false;
  for (const [sql, params] of seedStatements()) await db.execute(sql, params);
  await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('seed_version', ?)", [SEED_VERSION]);
  return true;
}
