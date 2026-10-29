// Scrapes the server-rendered level pages into seed/roadmap.json. Run: npm run scrape
import * as cheerio from "cheerio";
import { writeFileSync } from "node:fs";

const BASE = "https://ai-engineer-roadmap-2026.vercel.app";
const txt = (s: string) => s.replace(/\s+/g, " ").trim();

async function level(n: number) {
  const res = await fetch(`${BASE}/level/${n}/`);
  if (!res.ok) throw new Error(`level ${n}: HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const eyebrow = txt($(".lh__eyebrow").first().text()); // "Phase 2 · Retrieval"
  const m = eyebrow.match(/Phase (\d+)\s*·\s*(.+)/);
  if (!m) throw new Error(`level ${n}: bad eyebrow "${eyebrow}"`);

  const modules = $("[data-module]")
    .toArray()
    .map((el, i) => {
      const $m = $(el);
      const isCapstone = $m.hasClass("mod--cap");
      return {
        code: $m.attr("data-module")!,
        seq: i + 1,
        title: txt($m.find(".mod__name").first().text()),
        sessions: Number(txt($m.find(".mod__count").first().text())) || 0, // capstone links show "—"
        isCapstone,
        topics: $m
          .find(".topic")
          .toArray()
          .map((t) => ({
            label: txt($(t).find(".topic__label").text()),
            detail: txt($(t).find(".topic__detail").text()),
          })),
        outcome: txt($m.find(".mod__aside--out").text()).replace(/^Outcome\s*·\s*/, ""),
      };
    });

  const projects = $("aside.ship")
    .toArray()
    .map((el) => {
      const $s = $(el);
      return {
        moduleCode: ($s.attr("id") ?? "").replace(/^ship-/, "").replace(/^m(\d+)-(\d+)$/, "M$1.$2"),
        title: txt($s.find(".ship__title").text()),
        result: txt($s.find(".ship__result").text()),
        checklist: $s
          .find(".ship__item")
          .toArray()
          .map((i) => ({
            label: txt($(i).find(".ship__label").text()),
            detail: txt($(i).find(".ship__detail").text()),
          })),
      };
    });

  return {
    level: n,
    title: txt($(".lh__title").first().text()),
    phase: { number: Number(m[1]), name: m[2] },
    scope: txt($(".lh__scope").first().text()),
    modules,
    projects,
  };
}

const levels = [];
for (let n = 0; n <= 15; n++) levels.push(await level(n));
const sessions = levels.reduce((a, l) => a + l.modules.reduce((b, m) => b + m.sessions, 0), 0);
const modules = levels.reduce((a, l) => a + l.modules.length, 0);
const projects = levels.reduce((a, l) => a + l.projects.length, 0);
writeFileSync("seed/roadmap.json", JSON.stringify({ source: BASE, scrapedAt: new Date().toISOString(), levels }, null, 1));
console.log({ levels: levels.length, modules, sessions, projects });
