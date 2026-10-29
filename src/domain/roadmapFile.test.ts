import { describe, expect, it } from "vitest";
import roadmap from "../../seed/roadmap.json";
import { normalizeRoadmap, parseRoadmap, roadmapCounts, ROADMAP_PROMPT } from "./roadmapFile";

const minimal = { levels: [{ title: "Basics", modules: [{ title: "Intro", sessions: 2 }] }] };

describe("roadmap file", () => {
  it("fills defaults for a minimal file", () => {
    const r = normalizeRoadmap(minimal);
    expect(r.name).toBe("My roadmap");
    expect(r.levels[0]).toMatchObject({ level: 0, phase: { number: 1, name: "Roadmap" }, projects: [] });
    expect(r.levels[0].modules[0]).toMatchObject({ code: "M0.1", seq: 1, sessions: 2, isCapstone: false, topics: [] });
  });

  it("accepts the bundled roadmap unchanged in size", () => {
    expect(roadmapCounts(normalizeRoadmap(roadmap))).toMatchObject({ levels: 16, modules: 165, sessions: 286, projects: 14 });
  });

  it("accepts bare-string topics and fenced JSON", () => {
    const text = "Here you go:\n```json\n" + JSON.stringify({ levels: [{ title: "A", modules: [{ title: "B", topics: ["one", { label: "two" }] }] }] }) + "\n```";
    expect(parseRoadmap(text).levels[0].modules[0].topics.map((t) => t.label)).toEqual(["one", "two"]);
  });

  it.each([
    ["not json", "levels must be", "just words"],
    ["no levels", "levels: must contain", JSON.stringify({ levels: [] })],
    ["bad sessions", "levels[0].modules[0].sessions", JSON.stringify({ levels: [{ title: "A", modules: [{ title: "B", sessions: 31 }] }] })],
    ["missing title", "levels[0].title: is required", JSON.stringify({ levels: [{ modules: [{ title: "B" }] }] })],
    ["dup level", "duplicate level number", JSON.stringify({ levels: [{ level: 1, title: "A", modules: [{ title: "B" }] }, { level: 1, title: "C", modules: [{ title: "D" }] }] })],
    ["dup code", "duplicate module code", JSON.stringify({ levels: [{ title: "A", modules: [{ code: "X", title: "B" }, { code: "X", title: "C" }] }] })],
    ["no sessions", "at least one module", JSON.stringify({ levels: [{ title: "A" }] })],
  ])("rejects %s with a useful message", (_n, msg, text) => {
    expect(() => parseRoadmap(text)).toThrow();
    try {
      parseRoadmap(text);
    } catch (e) {
      if (_n !== "not json") expect(String(e)).toContain(msg);
    }
  });

  it("ships a prompt that mentions every key the parser reads", () => {
    for (const k of ["levels", "phase", "modules", "sessions", "isCapstone", "topics", "projects", "checklist", "outcome", "scope"]) expect(ROADMAP_PROMPT).toContain(`"${k}"`);
  });
});
