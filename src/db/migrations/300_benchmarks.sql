CREATE TABLE benchmarks (
  id         INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  metric     TEXT NOT NULL,
  value      REAL NOT NULL,
  unit       TEXT NOT NULL DEFAULT '',
  run_at     TEXT NOT NULL -- YYYY-MM-DD
);
CREATE INDEX idx_benchmarks_project ON benchmarks (project_id, run_at);
