import { describe, expect, it } from "vitest";
import { compatibility, FEATURES, PROVIDERS, providerById } from "./aiProviders";

describe("ai providers", () => {
  it("has unique ids and falls back to the CLI", () => {
    expect(new Set(PROVIDERS.map((p) => p.id)).size).toBe(PROVIDERS.length);
    expect(providerById("nope").id).toBe("claude-cli");
  });

  it("warns on every feature for local models, none for the tested CLI", () => {
    expect(compatibility(providerById("ollama")).rows.every((r) => r.support === "caution")).toBe(true);
    const cli = compatibility(providerById("claude-cli"));
    expect(cli.rows.every((r) => r.support === "ok")).toBe(true);
    expect(cli.caveats).toEqual([]);
    expect(cli.rows).toHaveLength(FEATURES.length);
  });

  it("tells API-provider users that review uploads their diff", () => {
    expect(compatibility(providerById("openai")).caveats.join(" ")).toContain("diff");
  });
});
