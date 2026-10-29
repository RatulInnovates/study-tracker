import { extractJson } from "./review";

export interface PortfolioInput {
  title: string;
  result: string;
  remote_url: string | null;
  demo_url: string | null;
  dod: { label: string; done: number }[];
  benchmarks: { metric: string; value: number; unit: string; run_at: string }[]; // newest first
}

/** README-ready summary; pure text, no model. Only the latest run of each metric is listed. */
export function buildReadme(p: PortfolioInput): string {
  const lines = [`# ${p.title}`, ""];
  if (p.result.trim()) lines.push(`> ${p.result.trim()}`, "");
  const links = [p.remote_url && `[Source](${p.remote_url})`, p.demo_url && `[Demo](${p.demo_url})`].filter(Boolean);
  if (links.length) lines.push(links.join(" · "), "");
  const done = p.dod.filter((d) => d.done);
  if (done.length) lines.push("## What it does", "", ...done.map((d) => `- ${d.label}`), "");
  const seen = new Set<string>();
  const latest = p.benchmarks.filter((b) => !seen.has(b.metric) && seen.add(b.metric));
  if (latest.length)
    lines.push("## Benchmarks", "", "| Metric | Value | Measured |", "| --- | --- | --- |", ...latest.map((b) => `| ${b.metric} | ${b.value}${b.unit ? ` ${b.unit}` : ""} | ${b.run_at} |`), "");
  return lines.join("\n").trimEnd() + "\n";
}

export const BULLETS_HINT = `{"bullets":["string"]}`;

export function buildBulletsPrompt(p: PortfolioInput) {
  return `Write 3 resume bullets for this project, each in STAR style (situation/task implied, then the action and a measurable result) in one line of at most 30 words, starting with a strong past-tense verb.
Use ONLY the facts below. Never invent numbers, tools or outcomes; if there is no metric, describe the outcome qualitatively.

Project: ${p.title}
Goal: ${p.result || "(none)"}
Completed requirements: ${p.dod.filter((d) => d.done).map((d) => d.label).join("; ") || "(none)"}
Measured results: ${p.benchmarks.map((b) => `${b.metric} = ${b.value}${b.unit ? ` ${b.unit}` : ""} (${b.run_at})`).join("; ") || "(none)"}

Reply with ONLY a JSON object, no prose, matching exactly: ${BULLETS_HINT}`;
}

export function parseBullets(text: string): string[] {
  const b = (extractJson(text) as { bullets?: unknown })?.bullets;
  if (!Array.isArray(b) || !b.length || !b.every((x) => typeof x === "string" && x.trim())) throw new Error("bullets must be a non-empty array of strings");
  return (b as string[]).map((x) => x.trim());
}
