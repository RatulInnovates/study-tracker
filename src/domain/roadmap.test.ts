import { describe, expect, it } from "vitest";
import { hasProjectDebt, matches, NO_FILTERS, type Searchable } from "./roadmap";

const s: Searchable = { title: "Intro to RAG", module_title: "Retrieval", module_code: "L7.2", status: "todo", kind: "study", level_num: 7 };

describe("matches", () => {
  it("passes with no filters and searches title, module title and code", () => {
    expect(matches(s, NO_FILTERS)).toBe(true);
    for (const q of [" rag ", "RETRIEVAL", "l7.2"]) expect(matches(s, { ...NO_FILTERS, q })).toBe(true);
    expect(matches(s, { ...NO_FILTERS, q: "nope" })).toBe(false);
  });
  it("combines status, kind and level", () => {
    expect(matches(s, { ...NO_FILTERS, status: "done" })).toBe(false);
    expect(matches(s, { ...NO_FILTERS, kind: "project" })).toBe(false);
    expect(matches(s, { ...NO_FILTERS, level: 7, status: "todo", kind: "study" })).toBe(true);
    expect(matches(s, { ...NO_FILTERS, level: 3 })).toBe(false);
  });
});

describe("hasProjectDebt", () => {
  const lv = { num: 3, unshipped: 1, total: 10, done: 4 };
  it("only when unshipped work is left behind", () => {
    expect(hasProjectDebt(lv, 3)).toBe(false); // still working on it
    expect(hasProjectDebt(lv, 4)).toBe(true); // moved on
    expect(hasProjectDebt({ ...lv, done: 10 }, 3)).toBe(true); // finished sessions
    expect(hasProjectDebt({ ...lv, unshipped: 0 }, 9)).toBe(false);
    expect(hasProjectDebt({ ...lv, total: 0, done: 0 }, 3)).toBe(false);
  });
});
