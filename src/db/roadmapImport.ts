import type { RoadmapData } from "../domain/roadmapFile";
import { writeRoadmap } from "./seed";
import { isoDay, replan } from "./today";
import type { Db } from "./types";

// Child tables first. Stories and interview attempts are keyed by free text, so they survive a roadmap swap.
const WIPE = [
  "card_reviews", "cards", "quiz_attempts", "quizzes", "reviews", "review_rules", "benchmarks", "project_dod_items", "projects",
  "session_notes", "focus_logs", "sessions", "topics", "modules", "levels", "phases",
];

/** Destroys all progress tied to the current roadmap (callers back up first), then loads `data` and schedules it from today. */
export async function replaceRoadmap(db: Db, data: RoadmapData) {
  for (const t of WIPE) await db.execute(`DELETE FROM ${t}`);
  await writeRoadmap(db, data);
  await replan(db, isoDay());
}

export async function hasRoadmap(db: Db) {
  return (await db.select("SELECT 1 FROM settings WHERE key = 'seed_version'")).length > 0;
}
