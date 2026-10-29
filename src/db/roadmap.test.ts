import { expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { loadRoadmap } from "./roadmap";

it("loads every level and session with module info", async () => {
  const db = memoryDb();
  await migrate(db);
  await seedIfNeeded(db);
  const { levels, sessions } = await loadRoadmap(db);
  expect(levels).toHaveLength(16);
  expect(sessions).toHaveLength(286);
  expect(sessions.every((s) => s.module_title && s.module_code)).toBe(true);
  expect(levels.reduce((n, l) => n + l.unshipped, 0)).toBe(14);
});
