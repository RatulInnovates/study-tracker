import { describe, expect, it } from "vitest";
import { nextDifficulty, parseGrades, parseQuiz, scorePct } from "./quiz";

const mcq = { type: "mcq", prompt: "p", options: ["a", "b"], answer: "a", explanation: "e" };

describe("quiz", () => {
  it("parses fenced JSON and rejects an answer that is not an option", () => {
    expect(parseQuiz("```json\n" + JSON.stringify({ questions: [mcq, { type: "short", prompt: "q", answer: "r" }] }) + "\n```")).toHaveLength(2);
    expect(() => parseQuiz(JSON.stringify({ questions: [{ ...mcq, answer: "z" }] }))).toThrow(/match one option/);
    expect(() => parseQuiz(JSON.stringify({ questions: [] }))).toThrow();
  });
  it("requires a grade for every short answer", () => {
    expect(parseGrades(JSON.stringify({ grades: [{ index: 3, correct: true, feedback: "" }] }), [3]).get(3)?.correct).toBe(true);
    expect(() => parseGrades(JSON.stringify({ grades: [] }), [3])).toThrow(/missing/);
  });
  it("adapts difficulty and scores", () => {
    expect(nextDifficulty([])).toBe("medium");
    expect(nextDifficulty([20, 40])).toBe("easy");
    expect(nextDifficulty([90, 100])).toBe("hard");
    expect(scorePct([{ correct: true, feedback: "" }, { correct: false, feedback: "" }, { correct: true, feedback: "" }])).toBe(67);
    expect(scorePct([])).toBe(0);
  });
});
