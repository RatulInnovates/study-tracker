import { describe, expect, it } from "vitest";
import { buildGradePrompt, parseFeedback, parseQuestion } from "./interview";

describe("interview", () => {
  it("parses a question and rejects an empty one", () => {
    expect(parseQuestion('{"question":"Why RAG?"}')).toBe("Why RAG?");
    expect(() => parseQuestion('{"question":" "}')).toThrow();
  });
  it("validates feedback shape and score range", () => {
    const ok = { score: 72.4, strengths: ["a"], gaps: [], model_answer: "m" };
    expect(parseFeedback(JSON.stringify(ok)).score).toBe(72);
    expect(() => parseFeedback(JSON.stringify({ ...ok, score: 101 }))).toThrow(/score/);
    expect(() => parseFeedback(JSON.stringify({ ...ok, gaps: "x" }))).toThrow(/gaps/);
  });
  it("uses the design rubric for design prompts", () => {
    expect(buildGradePrompt("design", "RAG", "q", "a")).toContain("failure modes");
    expect(buildGradePrompt("question", "RAG", "q", "")).toContain("(blank)");
  });
});
