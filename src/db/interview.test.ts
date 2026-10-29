import { expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { addStory, deleteStory, recentAttempts, recentQuestions, saveAttempt, stories, updateStory } from "./interview";

it("stores attempts newest first and round-trips stories", async () => {
  const db = memoryDb();
  await migrate(db);
  const fb = { score: 70, strengths: ["a"], gaps: ["b"], model_answer: "m" };
  await saveAttempt(db, { kind: "question", area: "RAG", question: "q1", answer: "a", seconds: 30, score: 70, feedback: fb });
  await saveAttempt(db, { kind: "design", area: "RAG", question: "q2", answer: "a", seconds: 90, score: 50, feedback: fb });
  expect((await recentAttempts(db)).map((a) => a.question)).toEqual(["q2", "q1"]);
  expect((await recentAttempts(db))[0].feedback).toEqual(fb);
  expect(await recentQuestions(db, "RAG", "question")).toEqual(["q1"]);

  await addStory(db, "Shipped RAG");
  const [s] = await stories(db);
  await updateStory(db, { ...s, result: "p95 -40%" });
  expect((await stories(db))[0].result).toBe("p95 -40%");
  await deleteStory(db, s.id);
  expect(await stories(db)).toHaveLength(0);
});
