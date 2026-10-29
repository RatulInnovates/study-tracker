import { describe, expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { getRules, reviewTargets, reviewsFor, saveReview, setRules } from "./reviews";

describe("reviews db", () => {
  it("stores rules and review history newest first", async () => {
    const db = memoryDb();
    await migrate(db);
    await seedIfNeeded(db);
    const [p] = await reviewTargets(db);
    expect(await getRules(db, p.id)).toBe("");
    await setRules(db, p.id, "use raw SQL");
    await setRules(db, p.id, "use raw SQL\ntest chunking");
    expect(await getRules(db, p.id)).toBe("use raw SQL\ntest chunking");

    const m = { verdict: "pass" as const, score: 90, summary: "s", issues: [], missing_requirements: ["x"] };
    await saveReview(db, p.id, "pass", m, "ok", true);
    await saveReview(db, p.id, "fail", { ...m, score: 40 }, "bad", false);
    const h = await reviewsFor(db, p.id);
    expect(h.map((r) => r.score)).toEqual([40, 90]);
    expect(h[0].tests_passed).toBe(false);
    expect(h[1].missing).toEqual(["x"]);
  });
});
