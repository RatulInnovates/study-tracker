import { describe, expect, it } from "vitest";
import { memoryDb } from "./node-db";
import { migrate } from "./migrate";
import { seedIfNeeded } from "./seed";
import { addBenchmark, benchmarksFor, deleteBenchmark, dodFor, listProjects, setDod, setProjectField } from "./projects";

async function setup() {
  const db = memoryDb();
  await migrate(db);
  await seedIfNeeded(db);
  return db;
}

describe("projects", () => {
  it("lists all 14 capstones with DoD progress", async () => {
    const db = await setup();
    const ps = await listProjects(db);
    expect(ps).toHaveLength(14);
    const p = ps[0];
    await setDod(db, (await dodFor(db, p.id))[0].id, true);
    expect((await listProjects(db))[0].dod_done).toBe(1);
  });

  it("stores empty fields as NULL and rejects unknown fields", async () => {
    const db = await setup();
    const [p] = await listProjects(db);
    await setProjectField(db, p.id, "repo_path", "C:/x");
    await setProjectField(db, p.id, "repo_path", "  ");
    expect((await listProjects(db))[0].repo_path).toBeNull();
    await expect(setProjectField(db, p.id, "title" as never, "x")).rejects.toThrow();
  });

  it("logs benchmarks newest first and deletes them", async () => {
    const db = await setup();
    const [p] = await listProjects(db);
    await addBenchmark(db, p.id, { metric: "recall@5", value: 0.8, unit: "", run_at: "2026-11-01" });
    await addBenchmark(db, p.id, { metric: "recall@5", value: 0.9, unit: "", run_at: "2026-11-02" });
    const rows = await benchmarksFor(db, p.id);
    expect(rows.map((r) => r.value)).toEqual([0.9, 0.8]);
    await deleteBenchmark(db, rows[0].id);
    expect(await benchmarksFor(db, p.id)).toHaveLength(1);
  });
});
