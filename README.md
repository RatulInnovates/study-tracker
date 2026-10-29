# Study Tracker

A local desktop app that turns **any study roadmap** into daily tasks, then checks your work with quizzes, spaced-repetition cards, AI code review and interview practice. Everything lives in a SQLite file on your computer. There is no account and no server.

It ships with the *AI Engineer Roadmap 2026* (16 levels, 165 modules, 286 sessions, 14 capstone projects), but you can load your own roadmap for anything: another field, a certification, a language.

## Install

1. Download the installer for your OS from the [Releases](../../releases) page (`.msi`/`.exe` for Windows, `.dmg` for macOS, `.AppImage`/`.deb` for Linux) and run it. Start it from the Start menu / Applications like any other app. No terminal or editor is needed.
2. The builds are unsigned. Windows SmartScreen ("More info" > "Run anyway") and macOS Gatekeeper (right-click the app > Open) ask you to confirm the first launch.
3. On first launch, choose a roadmap (see below).

## AI features: bring your own AI

Reviews, quizzes, interview practice and resume bullets need a model. Pick one in Settings > AI features (or on first launch):

- **Claude Code (default, no API key):** uses the Claude Code CLI installed on your machine with your own Claude Pro or Max login. This is the only option the author has tested.
- **API key:** Anthropic, OpenAI, Google Gemini, OpenRouter, Groq, or any OpenAI-compatible server. Billed per token by that provider, separately from a Claude subscription.
- **Local model:** Ollama (no key, nothing leaves your machine).

The key is saved in its own file in the app config folder, never in the database, so backups and exports cannot leak it, and it is only sent to the provider's URL. Settings shows which features may not work well with the provider you picked: code review needs a long context window and strict JSON, so small local models may fail on it; quiz and interview grading quality depends on the model. Code review sends your repo diff (not `.env`, key or ignored files) to whichever provider you chose.

For the Claude Code option:

```
npm install -g @anthropic-ai/claude-code
claude          # run once and sign in
```

Settings > AI features shows whether the app can find it, and "Test connection" checks any provider. Without it everything else (planning, notes, timer, projects, analytics, backups) still works.

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

## Build the installer yourself

`npm run package` builds a Windows `Study Tracker_<version>_x64-setup.exe` into `src-tauri/target/release/bundle/nsis/`. If the Rust build runs out of memory, set `CARGO_BUILD_JOBS=2` first.

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
