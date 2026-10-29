import { describe, expect, it } from "vitest";
import { normalizeRoadmap } from "../domain/roadmapFile";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { hasRoadmap, replaceRoadmap } from "./roadmapImport";
import { seedIfNeeded } from "./seed";
import { getSettings } from "./settings";

const count = async (db: ReturnType<typeof memoryDb>, t: string) => (await db.select<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`))[0].n;

describe("replaceRoadmap", () => {
  it("swaps the bundled roadmap for a custom one, wiping old progress", async () => {
    const db = memoryDb();
    await migrate(db);
    expect(await hasRoadmap(db)).toBe(false);
    await seedIfNeeded(db);
    expect(await hasRoadmap(db)).toBe(true);
    expect((await getSettings(db)).roadmap_name).toContain("AI Engineer");
    await db.execute("UPDATE sessions SET status = 'done', completed_at = '2026-01-01T00:00:00' WHERE seq = 1");
    await db.execute("INSERT INTO benchmarks (project_id, metric, value, unit, run_at) VALUES (1, 'm', 1, '', '2026-01-01')");

    await replaceRoadmap(db, normalizeRoadmap({ name: "Spanish", levels: [{ title: "A1", modules: [{ title: "Greetings", sessions: 2, topics: ["hola"] }], projects: [{ title: "Chat", checklist: ["say hi"] }] }] }));

    expect(await count(db, "sessions")).toBe(2);
    expect(await count(db, "levels")).toBe(1);
    expect(await count(db, "benchmarks")).toBe(0);
    expect(await count(db, "project_dod_items")).toBe(1);
    expect((await getSettings(db)).roadmap_name).toBe("Spanish");
    expect((await db.select("SELECT 1 FROM sessions WHERE status = 'done'")).length).toBe(0);
    expect((await db.select("SELECT 1 FROM sessions WHERE scheduled_date IS NULL")).length).toBe(0); // scheduled
    expect(await seedIfNeeded(db)).toBe(false); // the bundled roadmap must not come back on next launch
    expect(await count(db, "sessions")).toBe(2);
  });

  it("keeps settings such as the chosen study days", async () => {
    const db = memoryDb();
    await migrate(db);
    await db.execute("INSERT INTO settings (key, value) VALUES ('study_days', '0,6')");
    await replaceRoadmap(db, normalizeRoadmap({ levels: [{ title: "A", modules: [{ title: "B" }] }] }));
    expect((await getSettings(db)).study_days).toBe("0,6");
    const [s] = await db.select<{ scheduled_date: string }>("SELECT scheduled_date FROM sessions");
    expect([0, 6]).toContain(new Date(s.scheduled_date + "T12:00:00").getDay());
  });
});
