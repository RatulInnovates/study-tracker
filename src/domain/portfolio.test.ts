import { describe, expect, it } from "vitest";
import { buildBulletsPrompt, buildReadme, parseBullets, type PortfolioInput } from "./portfolio";

const p: PortfolioInput = {
  title: "RAG Bot",
  result: "A cited Q&A bot",
  remote_url: "https://github.com/x/y",
  demo_url: null,
  dod: [{ label: "Hybrid search", done: 1 }, { label: "Auth", done: 0 }],
  benchmarks: [
    { metric: "recall@5", value: 0.91, unit: "", run_at: "2026-10-02" },
    { metric: "recall@5", value: 0.8, unit: "", run_at: "2026-09-20" },
    { metric: "p95 latency", value: 420, unit: "ms", run_at: "2026-10-01" },
  ],
};

describe("portfolio", () => {
  it("README lists done items and only the latest run per metric", () => {
    const md = buildReadme(p);
    expect(md).toContain("- Hybrid search");
    expect(md).not.toContain("Auth");
    expect(md).toContain("| recall@5 | 0.91 | 2026-10-02 |");
    expect(md).not.toContain("| 0.8 |");
    expect(md).toContain("| p95 latency | 420 ms | 2026-10-01 |");
    expect(md).not.toContain("[Demo]");
  });

  it("README survives an empty project", () => {
    expect(buildReadme({ ...p, result: "", remote_url: null, dod: [], benchmarks: [] })).toBe("# RAG Bot\n");
  });

  it("prompt carries the real numbers", () => {
    expect(buildBulletsPrompt(p)).toContain("p95 latency = 420 ms");
  });

  it("parses bullets and rejects bad shapes", () => {
    expect(parseBullets('{"bullets":[" A "," B"]}')).toEqual(["A", "B"]);
    expect(() => parseBullets('{"bullets":[]}')).toThrow();
    expect(() => parseBullets('{"bullets":[1]}')).toThrow();
  });
});
