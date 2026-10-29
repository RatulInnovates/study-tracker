import { describe, expect, it } from "vitest";
import { daysBehind, readiness, weakest, weeklyVelocity } from "./analytics";

const today = "2026-10-29";

describe("analytics", () => {
  it("readiness uses available signals and decays when stale", () => {
    expect(readiness({ quiz: null, review: null, retention: null, lastActive: today }, today)).toBeNull();
    expect(readiness({ quiz: 80, review: null, retention: null, lastActive: today }, today)).toBe(80);
    expect(readiness({ quiz: 80, review: 60, retention: 100, lastActive: "2026-10-25" }, today)).toBe(Math.round((80 * 0.4 + 60 * 0.3 + 100 * 0.3) ));
    expect(readiness({ quiz: 100, review: null, retention: null, lastActive: "2026-01-01" }, today)).toBe(60);
  });
  it("weakest ignores areas without evidence", () => {
    expect(weakest([{ readiness: null }, { readiness: 70 }, { readiness: 40 }])).toEqual({ readiness: 40 });
    expect(weakest([{ readiness: null }])).toBeUndefined();
  });
  it("buckets completions by Monday-start week", () => {
    const v = weeklyVelocity(["2026-10-26T09:00:00", "2026-10-29T10:00:00", "2026-10-25T10:00:00"], today, 2);
    expect(v).toEqual([{ week: "2026-10-19", done: 1 }, { week: "2026-10-26", done: 2 }]);
  });
  it("days behind", () => {
    expect(daysBehind("2026-12-10", "2026-12-01")).toBe(9);
    expect(daysBehind(null, "2026-12-01")).toBeNull();
  });
});
