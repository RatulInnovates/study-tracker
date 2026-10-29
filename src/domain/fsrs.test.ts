import { describe, expect, it } from "vitest";
import { schedule, type CardState } from "./fsrs";

const NEW: CardState = { stability: 0, difficulty: 0, reps: 0, lapses: 0, due: "", last_review: null };
const t0 = new Date("2026-01-01T00:00:00Z");
const days = (c: CardState) => Math.round((new Date(c.due).getTime() - t0.getTime()) / 86_400_000);

describe("fsrs", () => {
  it("first review intervals grow with rating; again is tomorrow", () => {
    expect(days(schedule(NEW, 1, t0))).toBe(1);
    expect(days(schedule(NEW, 3, t0))).toBe(4);
    expect(days(schedule(NEW, 4, t0))).toBe(14);
  });
  it("a recalled card gets a longer interval; a lapse shrinks stability and counts", () => {
    const a = schedule(NEW, 3, t0);
    const later = new Date(a.due);
    expect(schedule(a, 3, later).stability).toBeGreaterThan(a.stability);
    const lapsed = schedule(a, 1, later);
    expect(lapsed.stability).toBeLessThan(a.stability);
    expect(lapsed.lapses).toBe(1);
  });
  it("difficulty stays within 1..10", () => {
    let c = schedule(NEW, 1, t0);
    for (let i = 0; i < 30; i++) c = schedule(c, 1, new Date(c.due));
    expect(c.difficulty).toBeLessThanOrEqual(10);
    expect(c.difficulty).toBeGreaterThanOrEqual(1);
  });
});
