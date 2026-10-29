import { describe, expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { cardCounts, dueCards, quizSessions, recentScores, reviewCard, saveAttempt, saveQuiz } from "./quiz";
import type { Question } from "../domain/quiz";

const qs: Question[] = [
  { type: "mcq", prompt: "A?", options: ["x", "y"], answer: "x", explanation: "because" },
  { type: "short", prompt: "B?", options: [], answer: "ref", explanation: "" },
];

describe("quiz + cards db", () => {
  it("wrong answers become due cards once, and reviewing reschedules them", async () => {
    const db = memoryDb();
    await migrate(db);
    await seedIfNeeded(db);
    const [s] = await quizSessions(db);
    const quiz = await saveQuiz(db, s.id, "medium", qs);
    const results = [{ correct: false, feedback: "" }, { correct: true, feedback: "" }];
    await saveAttempt(db, quiz.id, s.area, qs, ["y", "ref"], results, 50);
    await saveAttempt(db, quiz.id, s.area, qs, ["y", "ref"], results, 50);
    expect(await recentScores(db, s.id)).toEqual([50, 50]);
    expect(await cardCounts(db)).toEqual({ total: 1, due: 1 });

    const [card] = await dueCards(db);
    expect(card.back).toBe("x\n\nbecause");
    await reviewCard(db, card, 3);
    expect(await dueCards(db)).toHaveLength(0);
    expect((await cardCounts(db)).total).toBe(1);
  });
});
