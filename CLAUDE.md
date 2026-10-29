# Study Tracker

Local-first desktop app (Tauri 2 + React + TypeScript + Tailwind v4 + SQLite) that turns the AI Engineer Roadmap 2026
(16 levels, 165 modules, 286 sessions, 14 capstones) into daily tasks, then verifies the work with AI review and quizzes.
Full scope and milestones: `docs/PLAN.md`. Read it before starting a feature.

## How we work: one Claude session per feature branch
- Branch name: `feat/NN-name` (e.g. `feat/02-today-scheduler`). Never commit to `main`. Branch from an up-to-date `main`.
- Work only inside your feature. Touch `src/features/<name>/` freely. Elsewhere make only small additive edits:
  your line in `src/app/nav.ts`, your own migration file, new shared pieces in `src/ui/` or `src/domain/`.
  Need to change shared code or another feature? Stop and say so in the PR description instead.
- Commit small with clear messages. When done: run the checks below, push, `gh pr create` (squash-merge). Do not merge your own PR.
- Branch map: 01-foundation (done) · 02-today-scheduler · 03-roadmap · 04-projects · 05-settings-backup ·
  06-reviewer · 07-quiz-cards · 08-analytics · 09-interview.

## Commands
- `npm run tauri dev`  run the desktop app (first Rust build is slow)
- `npm run dev`        UI only in a browser (no database; DB calls will fail)
- `npm test`           Vitest (pure logic + DB tests on in-memory SQLite)
- `npx tsc --noEmit`   type check
- `npm run scrape`     refresh `seed/roadmap.json` from the live site (rarely needed)
- Windows: cargo lives in `~/.cargo/bin`, `gh` in `C:\Program Files\GitHub CLI`; add them to PATH if missing.

## Rules
- **SQL**: raw parameterized SQL (`?` placeholders) only, and only through `src/db/`. No ORM. Get the DB via `getDb()`.
- **Migrations**: `src/db/migrations/NNN_name.sql`, never edit an applied one. Number ranges per feature to avoid clashes:
  001-099 foundation, 100s today, 200s roadmap, 300s projects, 400s settings, 500s reviewer, 600s quiz/cards, 700s analytics, 800s interview.
  Split on `;` at end of line, so no `;` inside strings/triggers.
- **Logic**: pure functions in `src/domain/` with Vitest tests (scheduler, spaced repetition, readiness). No I/O there.
- **AI**: all model calls go through the `claude -p --output-format json` CLI (answer is in the `result` field). No API keys anywhere.
  Validate model JSON against a schema, retry once, surface errors in the UI. Calls take ~10s: show a spinner, run on demand.
- **Security**: commands the reviewer runs come from a per-project allowlist stored outside backups; never send `.env*`/key/gitignored files to the model.
- **Seed data** lives in `seed/roadmap.json` (committed). Counts are asserted in `src/db/db.test.ts`.

## UI rules
- Colors, radius, fonts come from tokens in `src/app/global.css`; no hardcoded hex in components. Dark and light must both work.
- Dense, calm, keyboard-first. One accent color for progress/primary/focus only. Use `PageHeader`, `EmptyState`, `ProgressRing` from `src/ui/`.
- Motion: CSS transitions on specific properties only (never `transition: all`), `ease-out`, 120-200ms, `.press` class for pressable things.
  **No animation on keyboard-triggered actions.** Honor `prefers-reduced-motion`. Gate hover effects with `@media (hover: hover)`.
- Every list needs an empty state and must survive worst-case data (long titles, 0 items, 286 items, missing fields).
- Accessible by default: real buttons/links, visible focus, labels on icon-only controls, Radix primitives for dialogs/menus/tooltips.

## Definition of done
`npm test` and `npx tsc --noEmit` pass; feature works in `npm run tauri dev`; worst-case data checked; PR description says what changed,
what was skipped, and any shared files touched.
