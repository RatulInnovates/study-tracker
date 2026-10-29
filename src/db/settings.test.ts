import { describe, expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { dumpAll, getSettings, setSetting } from "./settings";

describe("settings", () => {
  it("upserts and reads back", async () => {
    const db = memoryDb();
    await migrate(db);
    await setSetting(db, "theme", "light");
    await setSetting(db, "theme", "dark");
    expect(await getSettings(db)).toEqual({ theme: "dark" });
  });

  it("dumps every table including seed data", async () => {
    const db = memoryDb();
    await migrate(db);
    await seedIfNeeded(db);
    const dump = await dumpAll(db);
    expect(dump.sessions).toHaveLength(286);
    expect(dump.settings).toBeDefined();
  });
});
