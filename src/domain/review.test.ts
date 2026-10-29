import { describe, expect, it } from "vitest";
import { compareReviews, finalVerdict, parseReview, type Issue } from "./review";

const good = { verdict: "pass", score: 88.4, summary: "ok", issues: [{ file: "a.py", line: 3, severity: "low", message: "m", fix: "f" }], missing_requirements: [] };

describe("parseReview", () => {
  it("accepts fenced JSON and rounds the score", () => {
    const r = parseReview("Here:\n```json\n" + JSON.stringify(good) + "\n```");
    expect(r.score).toBe(88);
    expect(r.issues[0].line).toBe(3);
  });
  it("rejects schema violations", () => {
    expect(() => parseReview("no json")).toThrow();
    expect(() => parseReview(JSON.stringify({ ...good, verdict: "great" }))).toThrow(/verdict/);
    expect(() => parseReview(JSON.stringify({ ...good, issues: [{ file: "a" }] }))).toThrow(/issues\[0\]/);
  });
});

describe("finalVerdict", () => {
  it("failing tests override the model", () => {
    expect(finalVerdict("pass", false)).toBe("fail");
    expect(finalVerdict("pass", true)).toBe("pass");
    expect(finalVerdict("needs_work", null)).toBe("needs_work");
  });
});

describe("compareReviews", () => {
  const i = (message: string, line = 1): Issue => ({ file: "a", line, severity: "low", message, fix: "" });
  it("matches issues ignoring line drift", () => {
    const c = compareReviews({ score: 50, issues: [i("x"), i("y")] }, { score: 70, issues: [i("x", 9), i("z")] });
    expect(c.resolved.map((r) => r.message)).toEqual(["y"]);
    expect(c.added.map((r) => r.message)).toEqual(["z"]);
    expect(c.scoreDelta).toBe(20);
  });
});
