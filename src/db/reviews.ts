import type { Db } from "./types";
import type { Issue, ModelReview, Verdict } from "../domain/review";

export interface ReviewTarget {
  id: number;
  level_num: number;
  title: string;
  result: string;
  repo_path: string | null;
}
export interface ReviewRow {
  id: number;
  verdict: Verdict;
  score: number;
  summary: string;
  issues: Issue[];
  missing: string[];
  test_output: string;
  tests_passed: boolean | null;
  created_at: string;
}

export const reviewTargets = (db: Db) =>
  db.select<ReviewTarget>("SELECT p.id, l.num level_num, p.title, p.result, p.repo_path FROM projects p JOIN levels l ON l.id = p.level_id ORDER BY l.num, p.id");

export async function getRules(db: Db, projectId: number) {
  const [r] = await db.select<{ rules: string }>("SELECT rules FROM review_rules WHERE project_id = ?", [projectId]);
  return r?.rules ?? "";
}
export const setRules = (db: Db, projectId: number, rules: string) =>
  db.execute("INSERT INTO review_rules (project_id, rules) VALUES (?, ?) ON CONFLICT(project_id) DO UPDATE SET rules = excluded.rules", [projectId, rules]);

export const dodLabels = async (db: Db, projectId: number) =>
  (await db.select<{ label: string }>("SELECT label FROM project_dod_items WHERE project_id = ? ORDER BY seq", [projectId])).map((r) => r.label);

export async function saveReview(db: Db, projectId: number, verdict: Verdict, m: ModelReview, testOutput: string, testsPassed: boolean | null, now = new Date().toISOString()) {
  await db.execute(
    `INSERT INTO reviews (target_type, target_id, verdict, score, summary, issues_json, missing_json, test_output, tests_passed, created_at)
     VALUES ('project', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [projectId, verdict, m.score, m.summary, JSON.stringify(m.issues), JSON.stringify(m.missing_requirements), testOutput, testsPassed === null ? null : testsPassed ? 1 : 0, now],
  );
}

interface Raw extends Omit<ReviewRow, "issues" | "missing" | "tests_passed"> {
  issues_json: string;
  missing_json: string;
  tests_passed: number | null;
}
/** Newest first. */
export async function reviewsFor(db: Db, projectId: number): Promise<ReviewRow[]> {
  const rows = await db.select<Raw>("SELECT * FROM reviews WHERE target_type = 'project' AND target_id = ? ORDER BY id DESC", [projectId]);
  return rows.map(({ issues_json, missing_json, tests_passed, ...r }) => ({
    ...r,
    issues: JSON.parse(issues_json),
    missing: JSON.parse(missing_json),
    tests_passed: tests_passed === null ? null : tests_passed === 1,
  }));
}
