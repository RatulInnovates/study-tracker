import { describe, expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { planStats, pullNext, replan, setDone, sessionsOn } from "./today";

async function setup() {
  const db = memoryDb();
  await migrate(db);
  await seedIfNeeded(db);
  return db;
}

describe("replan", () => {
  it("schedules every todo session and keeps done ones untouched", async () => {
    const db = await setup();
    await replan(db, "2026-11-02");
    expect((await planStats(db, "2026-11-02")).unscheduled).toBe(0);
    const [first] = await sessionsOn(db, "2026-11-02");
    await setDone(db, first.id, true);
    await replan(db, "2026-11-09");
    const stats = await planStats(db, "2026-11-09");
    expect(stats.overdue).toBe(0); // nothing piles up behind today
    expect(stats.remaining).toBe(285);
    expect((await sessionsOn(db, "2026-11-02")).map((s) => s.id)).toEqual([first.id]);
  });

  it("a target end date pulls the projected finish in", async () => {
    const db = await setup();
    await replan(db, "2026-11-02");
    const slow = (await planStats(db, "2026-11-02")).finish!;
    await db.execute("INSERT INTO settings (key, value) VALUES ('target_end_date', '2027-03-01')");
    await replan(db, "2026-11-02");
    expect((await planStats(db, "2026-11-02")).finish! < slow).toBe(true);
  });

  it("pullNext moves the next session onto today", async () => {
    const db = await setup();
    await replan(db, "2026-11-03");
    await pullNext(db, "2026-11-02");
    expect(await sessionsOn(db, "2026-11-02")).toHaveLength(1);
  });
});
