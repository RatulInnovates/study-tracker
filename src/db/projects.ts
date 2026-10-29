import type { Db } from "./types";

export type ProjectStatus = "not_started" | "in_progress" | "shipped";
export interface ProjectRow {
  id: number;
  level_num: number;
  title: string;
  result: string;
  status: ProjectStatus;
  repo_path: string | null;
  remote_url: string | null;
  demo_url: string | null;
  dod_total: number;
  dod_done: number;
}
export interface Dod {
  id: number;
  label: string;
  detail: string;
  done: number;
}
export interface Benchmark {
  id: number;
  metric: string;
  value: number;
  unit: string;
  run_at: string;
}

export const listProjects = (db: Db) =>
  db.select<ProjectRow>(
    `SELECT p.id, l.num level_num, p.title, p.result, p.status, p.repo_path, p.remote_url, p.demo_url,
       (SELECT COUNT(*) FROM project_dod_items d WHERE d.project_id = p.id) dod_total,
       (SELECT COUNT(*) FROM project_dod_items d WHERE d.project_id = p.id AND d.done = 1) dod_done
     FROM projects p JOIN levels l ON l.id = p.level_id ORDER BY l.num, p.id`,
  );

const FIELDS = ["status", "repo_path", "remote_url", "demo_url"] as const;
/** Field names are whitelisted; empty strings are stored as NULL. */
export async function setProjectField(db: Db, id: number, field: (typeof FIELDS)[number], value: string) {
  if (!FIELDS.includes(field)) throw new Error(`bad field ${field}`);
  await db.execute(`UPDATE projects SET ${field} = ? WHERE id = ?`, [value.trim() || null, id]);
}

export const dodFor = (db: Db, projectId: number) =>
  db.select<Dod>("SELECT id, label, detail, done FROM project_dod_items WHERE project_id = ? ORDER BY seq", [projectId]);

export const setDod = (db: Db, id: number, done: boolean) => db.execute("UPDATE project_dod_items SET done = ? WHERE id = ?", [done ? 1 : 0, id]);

export const benchmarksFor = (db: Db, projectId: number) =>
  db.select<Benchmark>("SELECT id, metric, value, unit, run_at FROM benchmarks WHERE project_id = ? ORDER BY run_at DESC, id DESC", [projectId]);

export const addBenchmark = (db: Db, projectId: number, b: Omit<Benchmark, "id">) =>
  db.execute("INSERT INTO benchmarks (project_id, metric, value, unit, run_at) VALUES (?, ?, ?, ?, ?)", [projectId, b.metric.trim(), b.value, b.unit.trim(), b.run_at]);

export const deleteBenchmark = (db: Db, id: number) => db.execute("DELETE FROM benchmarks WHERE id = ?", [id]);
