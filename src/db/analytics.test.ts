import { expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { quizSessions, saveAttempt, saveQuiz } from "./quiz";
import { areaReadiness, hoursByLevel } from "./analytics";

it("aggregates quiz scores and focus time per level", async () => {
  const db = memoryDb();
  await migrate(db);
  await seedIfNeeded(db);
  const [s] = await quizSessions(db);
  const qs = [{ type: "short" as const, prompt: "B?", options: [], answer: "r", explanation: "" }];
  const quiz = await saveQuiz(db, s.id, "medium", qs);
  await saveAttempt(db, quiz.id, s.area, qs, ["x"], [{ correct: false, feedback: "" }], 40, "2026-10-28T10:00:00Z");
  await db.execute("INSERT INTO focus_logs (session_id, started_at, seconds) VALUES (?, ?, 7200)", [s.id, "2026-10-28"]);
  const rows = await areaReadiness(db, "2026-10-29");
  expect(rows).toHaveLength(16);
  const lvl = rows.find((r) => r.title === s.area)!;
  expect(lvl.quiz).toBe(40);
  expect(lvl.readiness).toBe(40);
  expect(rows.filter((r) => r.readiness !== null)).toHaveLength(1);
  expect((await hoursByLevel(db)).reduce((a, r) => a + r.study + r.project, 0)).toBe(2);
});
