import { extractJson } from "./review";

export interface Item {
  label: string;
  detail: string;
}
export interface RoadmapModule {
  code: string;
  seq: number;
  title: string;
  outcome: string;
  sessions: number;
  isCapstone: boolean;
  topics: Item[];
}
export interface RoadmapProject {
  title: string;
  result: string;
  checklist: Item[];
}
export interface RoadmapLevel {
  level: number;
  title: string;
  scope: string;
  phase: { number: number; name: string };
  modules: RoadmapModule[];
  projects: RoadmapProject[];
}
export interface RoadmapData {
  name: string;
  levels: RoadmapLevel[];
}

export const MAX_SESSIONS = 3000;
const bad = (path: string, why: string): never => {
  throw new Error(`${path}: ${why}`);
};
const obj = (v: unknown, path: string) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : bad(path, "must be an object"));
const arr = (v: unknown, path: string) => (Array.isArray(v) ? v : bad(path, "must be an array"));
const str = (v: unknown, path: string, required = false) => {
  if (v === undefined || v === null) return required ? bad(path, "is required") : "";
  if (typeof v !== "string") return bad(path, "must be a string");
  return v.trim() || (required ? bad(path, "must not be empty") : "");
};
const int = (v: unknown, path: string, min: number, max: number, fallback: number) => {
  if (v === undefined || v === null) return fallback;
  return Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : bad(path, `must be a whole number from ${min} to ${max}`);
};
/** Accepts {label, detail?} or a bare string, since models often emit plain strings. */
const items = (v: unknown, path: string): Item[] =>
  v === undefined || v === null
    ? []
    : arr(v, path).map((x, i) => (typeof x === "string" ? { label: str(x, `${path}[${i}]`, true), detail: "" } : { label: str(obj(x, `${path}[${i}]`).label, `${path}[${i}].label`, true), detail: str((x as Record<string, unknown>).detail, `${path}[${i}].detail`) }));

/** Validates and fills defaults. Throws an Error naming the first bad field, e.g. "levels[2].modules[0].sessions: must be ...". */
export function normalizeRoadmap(raw: unknown): RoadmapData {
  const root = obj(raw, "roadmap");
  const levels = arr(root.levels, "levels");
  if (!levels.length) bad("levels", "must contain at least one level");
  const nums = new Set<number>();
  const codes = new Set<string>();
  let sessions = 0;
  const out = levels.map((lv, li): RoadmapLevel => {
    const p = `levels[${li}]`;
    const l = obj(lv, p);
    const level = int(l.level, `${p}.level`, 0, 999, li);
    if (nums.has(level)) bad(`${p}.level`, `duplicate level number ${level}`);
    nums.add(level);
    const ph = l.phase === undefined ? {} : obj(l.phase, `${p}.phase`);
    const modules = arr(l.modules ?? [], `${p}.modules`).map((mv, mi): RoadmapModule => {
      const mp = `${p}.modules[${mi}]`;
      const m = obj(mv, mp);
      const code = str(m.code, `${mp}.code`) || `M${level}.${mi + 1}`;
      if (codes.has(code)) bad(`${mp}.code`, `duplicate module code ${code}`);
      codes.add(code);
      const n = int(m.sessions, `${mp}.sessions`, 0, 30, 1);
      sessions += n;
      return {
        code,
        seq: mi + 1,
        title: str(m.title, `${mp}.title`, true),
        outcome: str(m.outcome, `${mp}.outcome`),
        sessions: n,
        isCapstone: m.isCapstone === true,
        topics: items(m.topics, `${mp}.topics`),
      };
    });
    const titles = new Set<string>();
    const projects = arr(l.projects ?? [], `${p}.projects`).map((pv, pi): RoadmapProject => {
      const pp = `${p}.projects[${pi}]`;
      const pr = obj(pv, pp);
      const title = str(pr.title, `${pp}.title`, true);
      if (titles.has(title)) bad(`${pp}.title`, `duplicate project title "${title}" in this level`);
      titles.add(title);
      return { title, result: str(pr.result, `${pp}.result`), checklist: items(pr.checklist, `${pp}.checklist`) };
    });
    return {
      level,
      title: str(l.title, `${p}.title`, true),
      scope: str(l.scope, `${p}.scope`),
      phase: { number: int(ph.number, `${p}.phase.number`, 1, 999, 1), name: str(ph.name, `${p}.phase.name`) || "Roadmap" },
      modules,
      projects,
    };
  });
  if (sessions < 1) bad("levels", "needs at least one module with sessions");
  if (sessions > MAX_SESSIONS) bad("levels", `has ${sessions} sessions in total; the limit is ${MAX_SESSIONS}`);
  return { name: str(root.name, "name") || "My roadmap", levels: out.sort((a, b) => a.level - b.level) };
}

/** Parses a roadmap file's text; tolerates prose or ```json fences around the object. */
export function parseRoadmap(text: string): RoadmapData {
  let raw: unknown;
  try {
    raw = extractJson(text);
  } catch (e) {
    throw new Error(`Not valid JSON (${e instanceof Error ? e.message : e})`);
  }
  return normalizeRoadmap(raw);
}

export const roadmapCounts = (r: RoadmapData) => ({
  levels: r.levels.length,
  modules: r.levels.reduce((n, l) => n + l.modules.length, 0),
  sessions: r.levels.reduce((n, l) => n + l.modules.reduce((m, x) => m + x.sessions, 0), 0),
  projects: r.levels.reduce((n, l) => n + l.projects.length, 0),
});

/** Paste this into any AI chat, replacing the bracketed part with what you want to learn. */
export const ROADMAP_PROMPT = `You are a curriculum designer. Create a structured self-study roadmap for: [DESCRIBE WHAT YOU WANT TO LEARN, YOUR CURRENT LEVEL, AND HOW MANY MONTHS YOU HAVE].

Reply with ONLY one JSON object (no prose, no markdown fences) in exactly this shape:

{
  "name": "Short roadmap name",
  "levels": [
    {
      "level": 0,
      "title": "Level title",
      "scope": "One or two sentences on what this level covers.",
      "phase": { "number": 1, "name": "Phase name (several levels can share a phase)" },
      "modules": [
        {
          "code": "M0.1",
          "title": "Module title",
          "outcome": "What the learner can do after this module.",
          "sessions": 3,
          "isCapstone": false,
          "topics": [
            { "label": "Short checklist item", "detail": "One sentence describing what to learn or do." }
          ]
        }
      ],
      "projects": [
        {
          "title": "Project title",
          "result": "What the finished project is.",
          "checklist": [
            { "label": "Definition-of-done item", "detail": "How to tell it is done." }
          ]
        }
      ]
    }
  ]
}

Rules:
- "level" numbers start at 0, increase by 1, and are unique. Use 4 to 16 levels, ordered from basics to advanced.
- "sessions" is a whole number from 1 to 6: how many focused study sessions of about 90 minutes the module needs. Keep the total under 400.
- "code" values must be unique across the whole file.
- Every level needs at least one module and 3 to 8 topics per module. Put hands-on work in "projects" (about one per level) and mark a module "isCapstone": true only if it is a build-something module.
- Use only the keys shown. Output valid JSON: double quotes, no trailing commas, no comments.`;
