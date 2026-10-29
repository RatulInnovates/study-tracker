import { describe, expect, it } from "vitest";
import { paceFor, schedule, streak } from "./scheduler";

const study = (n: number, start = 1) => Array.from({ length: n }, (_, i) => ({ id: start + i, kind: "study" as const }));
const weekdays = [1, 2, 3, 4, 5];

describe("schedule", () => {
  it("fills perDay per study day and skips weekends", () => {
    // 2026-10-30 is a Friday
    const r = schedule(study(5), { from: "2026-10-30", studyDays: weekdays, perDay: 2 });
    expect(r.map((x) => x.date)).toEqual(["2026-10-30", "2026-10-30", "2026-11-02", "2026-11-02", "2026-11-03"]);
  });

  it("gives each day one project slot and keeps roadmap order", () => {
    const r = schedule([...study(1), { id: 2, kind: "project" }, { id: 3, kind: "project" }], { from: "2026-11-02", studyDays: weekdays, perDay: 1 });
    expect(r.map((x) => x.date)).toEqual(["2026-11-02", "2026-11-02", "2026-11-03"]);
  });

  it("is a rolling plan: replanning later never yields dates before `from`", () => {
    const r = schedule(study(3), { from: "2026-11-10", studyDays: weekdays, perDay: 3 });
    expect(r.every((x) => x.date >= "2026-11-10")).toBe(true);
  });

  it("rejects an empty week", () => {
    expect(() => schedule(study(1), { from: "2026-11-02", studyDays: [], perDay: 1 })).toThrow();
  });
});

describe("paceFor", () => {
  it("raises pace to hit the end date, capped at 3", () => {
    expect(paceFor(10, "2026-11-02", "2026-11-06", weekdays)).toBe(2);
    expect(paceFor(100, "2026-11-02", "2026-11-06", weekdays)).toBe(3);
    expect(paceFor(1, "2026-11-02", "2026-11-06", weekdays)).toBe(1);
  });
  it("end date already past gives max pace", () => {
    expect(paceFor(5, "2026-11-02", "2026-10-01", weekdays)).toBe(3);
  });
});

describe("streak", () => {
  it("counts back from today, tolerating pending today and weekends", () => {
    // Mon 11-09 pending; Fri 11-06, Thu 11-05 done; weekend off
    expect(streak(["2026-11-06", "2026-11-05"], "2026-11-09", weekdays)).toBe(2);
  });
  it("breaks on a missed study day", () => {
    expect(streak(["2026-11-09", "2026-11-05"], "2026-11-09", weekdays)).toBe(1);
  });
  it("is 0 with no history", () => {
    expect(streak([], "2026-11-09", weekdays)).toBe(0);
  });
});
