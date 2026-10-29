import { describe, expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";

const count = async (db: ReturnType<typeof memoryDb>, table: string) =>
  (await db.select<{ n: number }>(`SELECT COUNT(*) n FROM ${table}`))[0].n;

describe("migrate + seed", () => {
  it("matches the live roadmap counts", async () => {
    const db = memoryDb();
    expect((await migrate(db)).length).toBeGreaterThan(0);
    expect(await seedIfNeeded(db)).toBe(true);
    expect(await count(db, "phases")).toBe(7);
    expect(await count(db, "levels")).toBe(16);
    expect(await count(db, "modules")).toBe(165);
    expect(await count(db, "sessions")).toBe(286);
    expect(await count(db, "projects")).toBe(14);
    expect(await count(db, "project_dod_items")).toBeGreaterThan(30);
  });

  it("is idempotent", async () => {
    const db = memoryDb();
    await migrate(db);
    await seedIfNeeded(db);
    expect(await migrate(db)).toEqual([]);
    expect(await seedIfNeeded(db)).toBe(false);
    expect(await count(db, "sessions")).toBe(286);
  });
});
