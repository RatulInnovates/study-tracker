# Study Tracker

A local desktop app that turns **any study roadmap** into daily tasks, then checks your work with quizzes, spaced-repetition cards, AI code review and interview practice. Everything lives in a SQLite file on your computer. There is no account and no server.

It ships with the *AI Engineer Roadmap 2026* (16 levels, 165 modules, 286 sessions, 14 capstone projects), but you can load your own roadmap for anything: another field, a certification, a language.

## Install

1. Download the installer for your OS from the [Releases](../../releases) page (`.msi`/`.exe` for Windows, `.dmg` for macOS, `.AppImage`/`.deb` for Linux) and run it. Start it from the Start menu / Applications like any other app. No terminal or editor is needed.
2. The builds are unsigned. Windows SmartScreen ("More info" > "Run anyway") and macOS Gatekeeper (right-click the app > Open) ask you to confirm the first launch.
3. On first launch, choose a roadmap (see below).

## AI features: bring your own Claude account

Reviews, quizzes, interview practice and resume bullets call the **Claude Code CLI** installed on your machine, using your own Claude Pro or Max subscription. The app has no API keys and sends nothing anywhere else.

```
npm install -g @anthropic-ai/claude-code
claude          # run once and sign in
```

Settings > AI features shows whether the app can find it. Without it everything else (planning, notes, timer, projects, analytics, backups) still works.

## Use your own roadmap

Settings > Roadmap (or the first-launch screen) > **Copy AI prompt for making one**. Paste the prompt into Claude or any AI chat, describe what you want to learn, save the reply as a `.json` file and choose it in the app. The app validates it and tells you the exact field if something is wrong, then shows a summary before loading.

The format, if you would rather write it by hand (only `levels[].title` and `modules[].title` are required; everything else has a default):

```json
{
  "name": "Spanish A1",
  "levels": [
    {
      "level": 0,
      "title": "Greetings",
      "scope": "What this level covers.",
      "phase": { "number": 1, "name": "Basics" },
      "modules": [
        {
          "code": "M0.1",
          "title": "Introductions",
          "outcome": "Introduce yourself and others.",
          "sessions": 3,
          "isCapstone": false,
          "topics": [{ "label": "Hola / adios", "detail": "Greet people at different times of day." }]
        }
      ],
      "projects": [
        { "title": "Record a self-introduction", "result": "A 1 minute recording.", "checklist": [{ "label": "Uses 5 phrases", "detail": "" }] }
      ]
    }
  ]
}
```

Loading a roadmap **replaces** the current one and deletes the progress, notes, quizzes, cards and reviews tied to it. The app saves a backup first (`before-import-*.db` in the backups folder). Settings, interview history and stories are kept.

## Your data

- One SQLite file in the app's config folder (Settings > Backup shows the backups folder). A backup is taken automatically once a day, newest 7 kept. You can export the database or a JSON dump and import a backup there.
- The reviewer only runs commands you allow per project, and never sends `.env*`, key files or gitignored files to the model.

## Build from source

Needs Node 22+, Rust (stable) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```
npm install
npm run tauri dev      # run the app with hot reload
npm run tauri build    # installers land in src-tauri/target/release/bundle
npm test               # unit + in-memory SQLite tests
npx tsc --noEmit       # type check
```

To publish installers: push a tag such as `v0.2.0`. The Release workflow builds Windows, macOS and Linux and attaches them to a draft GitHub release.

`CLAUDE.md` and `docs/PLAN.md` describe the architecture and contribution rules.
