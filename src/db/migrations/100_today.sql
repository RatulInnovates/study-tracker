CREATE TABLE session_notes (
  session_id INTEGER PRIMARY KEY REFERENCES sessions(id),
  body       TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE focus_logs (
  id         INTEGER PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id),
  started_at TEXT NOT NULL,
  seconds    INTEGER NOT NULL
);
CREATE INDEX idx_focus_session ON focus_logs (session_id);
