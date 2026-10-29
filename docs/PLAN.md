# AI Engineer Prep Tracker — Enhanced Plan

## Context
You want a local desktop app that turns the "AI Engineer Roadmap 2026" (7 phases, 16 levels L0–L15, 165 modules, 286 sessions, 14 capstone projects in 13 of 16 levels; https://ai-engineer-roadmap-2026.vercel.app) into daily tasks, and checks that your work is actually good (AI code review + quizzes). The Gemini chat produced a decent feature list but a bloated, over-gated design. This plan keeps the core, cuts the risky parts, and fixes the weak spots. Features and stack below are my own choices; the chat's are ignored.

## Problems in the original idea (and the fix)
| Weakness | Fix |
|---|---|
| Hard gating ("level locked until project done") blocks you when one project stalls | **Soft gating**: next level stays open, but shows a "project debt" badge and a nudge |
| 286 sessions auto-spread evenly breaks on the first missed day | **Rolling scheduler**: reschedules only the *remaining* sessions from today, never piles up an overdue wall |
| Claude Pro doesn't cover API, so a separate bill | **One reviewer backend**: `claude -p` headless CLI on your Pro login. No API key, no separate bill (verified working on this machine, v2.1.312) |
| Reviewer reads one file and trusts the LLM's pass/fail | **Run-then-judge**: run the project's tests/linters first, send results + diff + rubric to the model; LLM verdict never overrides failing tests |
| Quizzes generated at "mark complete" are shallow and never revisited | Wrong answers become recall cards automatically (closes the loop) |
| Tracks completion, not readiness | **Readiness score** per skill area drives what you study next |
| Roadmap data scraped by hand-guess (the chat's table is garbled) | Scrape the real site once into a versioned `roadmap.json` seed; verify counts (16 levels / 165 modules / 286 sessions / 14 capstones, as shown on the live site) in a test |

## Stack (my pick)
- **Tauri 2 + React + TypeScript + Vite + Tailwind** — small installer, native feel. Rust surface kept near zero: only the stock `sql`, `fs`, `shell`, `dialog`, `notification` plugins.
- **SQLite** (tauri-plugin-sql), hand-written SQL + a tiny migration runner (numbered `.sql` files). No ORM.
- **State**: TanStack Query over SQL helpers; Zustand only for UI state.
- **Charts**: Recharts. **Roadmap graph**: React Flow. **Markdown**: CodeMirror 6 + `react-markdown`.
- **Tests**: Vitest for scheduler/SRS/readiness logic (pure functions); one Playwright smoke test later.
- **No API key anywhere**: all AI calls go through the `claude` CLI you are already logged into.

## Features (prioritized)

### MVP (v0.1) — "I open it every morning"
1. **Today view**: max 3 sessions + 1 micro-build, progress ring, streak. Each session has a checklist, notes (markdown), and a focus timer tied to the session.
2. **Roadmap seed + browser**: phases → levels → sessions, search, filter by status.
3. **Rolling scheduler**: set target end date + weekly study days/hours; "I missed a day" button recomputes remaining plan; shows projected finish date live.
4. **Capstone hub**: per project — repo path, remote URL, definition-of-done checklist, benchmark log (metric name/value/date), demo link.
5. **Backup**: one-click export/import of the SQLite file + JSON export; auto-backup on launch (keep last 7).

### v0.2 — "It verifies me"
6. **AI Code Reviewer** (per coding task/capstone):
   - Pick files/folder → app runs configured command (`pytest`, `ruff`, `npm test`) → collects output.
   - Sends diff + test output + task rubric to Claude; requires strict JSON `{verdict, score, issues[{file,line,severity,fix}], missing_requirements[]}` validated with a schema; retries once on invalid JSON.
   - Per-task custom rules (e.g. "must use raw SQL", "chunking must be tested").
   - History of reviews per task; re-review shows what changed.
7. **Quiz engine**: scenario-based MCQ + short-answer, graded by model; difficulty adapts to past scores; wrong answers → recall cards.
8. **Spaced repetition**: FSRS-style scheduling (better than Leitner boxes, small pure function, unit-tested). Daily review queue capped at ~15 cards, shown *before* new material.

### v0.3 — "It tells me where I'm weak"
9. **Readiness dashboard**: score per area (RAG, agents, evals, security, system design, fine-tuning…) from quiz accuracy, review pass rate, card retention, and recency. "Weakest area" suggestion injected into Today view.
10. **Time analytics**: hours per level, theory vs hands-on ratio, weekly velocity vs plan, burndown to target date.
11. **Interview mode** (L15 focus): mock question generator by area, timed answer + rubric grading, system-design prompt with structured feedback, STAR story bank.
12. **Portfolio export**: finished capstones → resume bullets (STAR) and a README-ready summary with the benchmark numbers you logged.

### Later / only if wanted
GitHub commit watcher (read local `git log` rather than the API first), global hotkey quick-capture note, DSA/LeetCode log, sync to a second machine via file-based backup folder.

### Explicitly skipped (and why)
Cloud sync/accounts (not needed, local-first), gamification XP/badges (streak + ring is enough), plugin system, multi-user, mobile.

## Data model (additions to a standard phases/levels/sessions tree)
- `sessions(id, level_id, seq, title, kind[theory|coding|project|eval], est_minutes, status, scheduled_date, completed_at)`
- `session_notes`, `focus_logs(session_id, started_at, seconds)`
- `projects(id, level_id, repo_path, remote_url, status)` + `project_dod_items` + `benchmarks(project_id, metric, value, unit, run_at)`
- `reviews(id, target_type, target_id, backend, verdict, score, issues_json, test_output, created_at)`
- `quizzes(id, session_id, questions_json, created_at)` + `quiz_attempts(quiz_id, answers_json, score, taken_at)`
- `cards(id, area, front, back, source[quiz|manual|review], due, stability, difficulty, reps, lapses)` + `card_reviews`
- `settings(key, value)`; `schema_migrations(version)`
- Indexes on `sessions(scheduled_date,status)`, `cards(due)`.

## Architecture notes
- `src/db/` — SQL files + typed query helpers (the only place SQL lives).
- `src/domain/` — pure logic: `scheduler.ts`, `fsrs.ts`, `readiness.ts` (all unit-tested, no I/O).
- `src/ai/` — `claude.ts` (spawns `claude -p --output-format json` via shell plugin; the model text is in the `result` field); prompt templates + JSON schemas in one folder.
- `src/features/{today,roadmap,projects,review,quiz,cards,analytics,interview}/`
- `scripts/scrape-roadmap.ts` → `src-tauri/seed/roadmap.json` (committed, versioned).
- Safety: reviewer only reads paths you pick; commands run from an allowlist you configure per project; file contents truncated/size-capped before sending; show token estimate before send.

## Milestones
1. **M1 Foundation (day 1–2)**: scaffold Tauri+React, migration runner, scrape roadmap → seed, verify 286 sessions / 165 modules / 14 capstones in a test. Scrape source: per-level pages `/level/0/`..`/level/15/` (server-rendered HTML).
2. **M2 Today + scheduler (day 3–5)**: Today view, checklist/notes/timer, rolling scheduler with tests.
3. **M3 Projects + backup (day 6–7)**: capstone hub, benchmarks, export/import.
4. **M4 Reviewer (week 2)**: provider interface, CLI backend first, test-runner step, JSON schema validation, review history.
5. **M5 Quiz + cards (week 3)**: quiz generation/grading, FSRS queue, wrong-answer → card.
6. **M6 Analytics + readiness (week 4)**: dashboard, weak-area nudges.
7. **M7 Interview mode + export (week 5+)**.
Dogfood from M2 onward — use it for real study from week 1.

## Frontend plan

### Prerequisites (blockers found)
`gh` CLI and Rust (rustup + MSVC Build Tools) are not installed. Step 0 = install both (`winget install GitHub.cli Rustlang.Rustup Microsoft.VisualStudio.2022.BuildTools`), then `gh auth login` (you run it). Node 24 is present.

### Design direction
A calm, dense, keyboard-first daily tool opened every morning. Not a landing page: no hero, no gradient, no purple.
- **Look**: dark-first with light theme (follows OS, manual toggle). One accent (teal-green, `#2dd4a0` dark / `#0f9d74` light) used only for progress, primary action and focus. Neutral grays for everything else. Phase colors are muted tints used only on small chips/dots.
- **Type**: system UI font stack for text; `JetBrains Mono` (bundled locally, works offline) for numbers, timers, code. Scale 12/13/14/16/20/28; tabular numerals for timers and counts.
- **Tokens** as CSS variables on `:root`, redefined for dark/light (Tailwind v4 `@theme`). 4px spacing grid, radius 6/10, 1px borders instead of shadows.
- **Motion (CSS only, no animation library)**: transitions over keyframes; `ease-out cubic-bezier(0.23,1,0.32,1)`; 120–200ms; press = `scale(0.97)` on `:active`; hover effects gated by `@media (hover:hover)`. **No animation on keyboard actions** (Ctrl+K palette, nav shortcuts, checking a task via keyboard). Only animate: checkbox tick, progress ring/bar fill, drawer slide (200ms), toast. Respect `prefers-reduced-motion` (keep opacity, drop movement).

### Layout
```
┌ sidebar 208px ┬───────────────────────────────┬ drawer 420px (on select) ┐
│ Today         │  page header (title, date)    │  Session detail           │
│ Roadmap       │  page body                    │  checklist · notes · timer│
│ Projects      │                               │                           │
│ Review (v0.2) │                               │                           │
│ Stats  (v0.3) │                               │                           │
│ Settings      │                               │                           │
└───────────────┴───────────────────────────────┴───────────────────────────┘
```
Sidebar collapses to icons under 900px. Drawer is a right panel, not a modal (Esc closes). Custom titlebar not needed.

### Screens
1. **Today**: header (date, streak, progress ring "2/4"); "Cards due" strip placed first once v0.2 lands; list of up to 3 session rows + 1 micro-build row. Row = checkbox, title, level chip (`L4`), kind badge, est. minutes, play button. Empty state: "Done for today" plus "pull tomorrow's session". Overdue shows as a gentle count banner with "Reschedule" (never a red wall).
2. **Roadmap**: search + filters (status, kind, level). Phases as collapsible groups → level rows with progress bar and project-debt badge → expands to modules → sessions. Plain nested list (no node graph in v0.1).
3. **Session drawer**: title, source link to the level page, checklist (the session's tasks), markdown notes in a plain `<textarea>` with debounced autosave and a preview toggle, focus timer (start/pause, running total).
4. **Projects**: grid of 14 cards (title, level, status, repo path chip, definition-of-done progress). Detail view: repo/remote/demo fields, DoD checklist, benchmarks table + add row.
5. **Settings**: target end date, study days/week, hours/day, theme, backup export/import, auto-backup folder.
6. **Command palette (Ctrl+K)**: jump to level/session/page; `cmdk`. Shortcuts: `g t/r/p` navigate, `Space` toggle timer, `x` complete selected, `Esc` close drawer.

### Frontend stack (additions to the main stack)
Radix primitives (Dialog, Tooltip, Checkbox, Tabs, Popover) for accessibility, `lucide-react` icons, `cmdk`, `sonner` toasts, `wouter` router (tiny), TanStack Query + Zustand (UI state only), `date-fns`. No Framer Motion, no chart/graph/editor libraries until a feature needs them.

### Structure
```
src/
  app/            shell, router, providers, global.css (tokens)
  ui/             Button, Checkbox, Chip, ProgressRing, Drawer, EmptyState, Kbd (shared, small)
  db/client.ts    query(sql, params) wrapper over tauri-plugin-sql (single seam)
  db/migrations/  NNN_name.sql   (each feature branch reserves a number range)
  domain/         pure logic + tests
  features/today|roadmap|projects|settings/   one folder per feature branch
```
Rule: a feature touches only its own `features/<name>/` folder, plus additive edits to `app/router`, the sidebar item list and its own migration file. This keeps parallel branches from conflicting.

### Frontend milestones (map to branches)
- `feat/01-foundation`: Tauri+Vite scaffold, tokens/themes, shell + sidebar + router, `ui/` primitives, migration runner, seed + scraper, seed-count test.
- `feat/02-today-scheduler`: Today view, session drawer, timer, scheduler domain + tests.
- `feat/03-roadmap`: Roadmap browser, search/filter.
- `feat/04-projects`: Projects hub, benchmarks.
- `feat/05-settings-backup`: Settings, export/import, auto-backup (includes the command-allowlist-not-in-backup rule).
- Later: `feat/06-reviewer`, `feat/07-quiz-cards`, `feat/08-analytics`, `feat/09-interview`.

### Frontend quality checks
- Stress each list/card with worst-case data (very long titles, 0 items, 286 items, missing fields) behind a dev-only "worst case" toggle (break-ui approach).
- Keyboard-only walkthrough of Today; visible focus rings; contrast AA in both themes; reduced-motion check.
- Vitest + Testing Library for Today row, drawer autosave, and empty states.

## Repo & session setup (done in feat/01-foundation, step 1)
- `git init`, private GitHub repo via `gh repo create study-tracker --private --source . --push`, `main` protected by habit (no direct commits), one branch per feature (`feat/NN-name`), squash-merge via PR.
- `.gitignore` (node_modules, target, dist, `*.db`, `.env*`), keep `PLAN.md` and the PDF out of the repo or in `docs/`.
- **CLAUDE.md** (one per repo, written for single-feature sessions): project summary and current milestone; stack and run/test commands (`npm run dev`, `npm run tauri dev`, `npm test`); branch rule (work only on your branch, never on `main`, name `feat/NN-name`, commit small, open PR when done); ownership rule (touch only your `features/<name>/` folder, additive edits elsewhere); migration numbering by range per feature; design rules (tokens only, no hardcoded colors, motion rules above, no animation on keyboard actions); data rule (SQL only in `src/db/`, no ORM); AI rule (all AI via `claude -p`, no API key); "definition of done" (tests pass, lint passes, worst-case data checked, PR description written); pointer to `docs/PLAN.md` for scope. Short, imperative, under ~80 lines.

## Verification
- `npm run test` — scheduler (missed-day reschedule, end-date projection), FSRS due dates, readiness math, seed counts.
- `npm run tauri dev` — walk: open app → Today shows ≤3+1 tasks → complete one → timer logs → mark a day missed → plan shifts, finish date updates.
- Reviewer: point at a deliberately broken sample project → verdict must fail (tests red); fix it → passes; malformed model JSON → retried then surfaced as error, not crash.
- Backup: export, delete DB, import → all progress restored.
- `npm run tauri build` produces a Windows installer that launches and creates its DB on first run.

## Open items to confirm during M1
- Exact roadmap structure from the live site (the chat's level→phase table was garbled in the PDF).
- `claude -p` verified working (returns JSON, `result` field holds the answer). Known cost: ~11s per call, so show a spinner and run reviews/quizzes on demand. Pro plan usage limits apply.
