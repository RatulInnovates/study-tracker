CREATE TABLE phases (
  id     INTEGER PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  name   TEXT NOT NULL
);

CREATE TABLE levels (
  id       INTEGER PRIMARY KEY,
  num      INTEGER NOT NULL UNIQUE,
  phase_id INTEGER NOT NULL REFERENCES phases(id),
  title    TEXT NOT NULL,
  scope    TEXT NOT NULL DEFAULT ''
);

CREATE TABLE modules (
  id          INTEGER PRIMARY KEY,
  level_id    INTEGER NOT NULL REFERENCES levels(id),
  code        TEXT NOT NULL UNIQUE,
  seq         INTEGER NOT NULL,
  title       TEXT NOT NULL,
  outcome     TEXT NOT NULL DEFAULT '',
  is_capstone INTEGER NOT NULL DEFAULT 0
);

-- the checklist shown in the session drawer
CREATE TABLE topics (
  id        INTEGER PRIMARY KEY,
  module_id INTEGER NOT NULL REFERENCES modules(id),
  seq       INTEGER NOT NULL,
  label     TEXT NOT NULL,
  detail    TEXT NOT NULL DEFAULT '',
  done      INTEGER NOT NULL DEFAULT 0,
  UNIQUE (module_id, seq)
);

CREATE TABLE sessions (
  id             INTEGER PRIMARY KEY,
  module_id      INTEGER NOT NULL REFERENCES modules(id),
  seq            INTEGER NOT NULL UNIQUE, -- 1..286, roadmap order
  idx_in_module  INTEGER NOT NULL,
  title          TEXT NOT NULL,
  kind           TEXT NOT NULL DEFAULT 'study' CHECK (kind IN ('study', 'project')),
  est_minutes    INTEGER NOT NULL DEFAULT 90,
  status         TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'skipped')),
  scheduled_date TEXT, -- YYYY-MM-DD
  completed_at   TEXT,
  UNIQUE (module_id, idx_in_module)
);
CREATE INDEX idx_sessions_schedule ON sessions (scheduled_date, status);

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY,
  level_id   INTEGER NOT NULL REFERENCES levels(id),
  title      TEXT NOT NULL,
  result     TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'not_started'
             CHECK (status IN ('not_started', 'in_progress', 'shipped')),
  repo_path  TEXT,
  remote_url TEXT,
  demo_url   TEXT,
  UNIQUE (level_id, title)
);

CREATE TABLE project_dod_items (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  seq        INTEGER NOT NULL,
  label      TEXT NOT NULL,
  detail     TEXT NOT NULL DEFAULT '',
  done       INTEGER NOT NULL DEFAULT 0,
  UNIQUE (project_id, seq)
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
