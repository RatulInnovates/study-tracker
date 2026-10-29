import type { Db } from "./types";
import roadmap from "../../seed/roadmap.json";
import { normalizeRoadmap, type RoadmapData } from "../domain/roadmapFile";

type Stmt = [sql: string, params: unknown[]];

/** Every statement is INSERT OR IGNORE, so a half-finished seed can simply be re-run. */
export const bundledRoadmap = () => normalizeRoadmap({ name: "AI Engineer Roadmap 2026", ...roadmap });

export function seedStatements(data: RoadmapData = bundledRoadmap()): Stmt[] {
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


export async function seedIfNeeded(db: Db): Promise<boolean> {
  const [row] = await db.select<{ value: string }>("SELECT value FROM settings WHERE key = 'seed_version'");
  if (row) return false; // any value: a custom import also sets it, and must never be overwritten by the bundled roadmap
  await writeRoadmap(db, bundledRoadmap());
  return true;
}

/** Writes `data` and marks the DB as seeded. Callers wipe first when replacing (see replaceRoadmap). */
export async function writeRoadmap(db: Db, data: RoadmapData) {
  for (const [sql, params] of seedStatements(data)) await db.execute(sql, params);
  await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('roadmap_name', ?)", [data.name]);
  await db.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('seed_version', '1')");
}
