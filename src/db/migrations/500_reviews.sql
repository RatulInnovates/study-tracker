CREATE TABLE reviews (
  id           INTEGER PRIMARY KEY,
  target_type  TEXT NOT NULL DEFAULT 'project',
  target_id    INTEGER NOT NULL,
  backend      TEXT NOT NULL DEFAULT 'claude-cli',
  verdict      TEXT NOT NULL CHECK (verdict IN ('pass', 'needs_work', 'fail')),
  score        INTEGER NOT NULL,
  summary      TEXT NOT NULL DEFAULT '',
  issues_json  TEXT NOT NULL DEFAULT '[]',
  missing_json TEXT NOT NULL DEFAULT '[]',
  test_output  TEXT NOT NULL DEFAULT '',
  tests_passed INTEGER, -- NULL when no commands were run
  created_at   TEXT NOT NULL
);
CREATE INDEX idx_reviews_target ON reviews (target_type, target_id, id);

-- per-project custom rubric lines, one per line
CREATE TABLE review_rules (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id),
  rules      TEXT NOT NULL DEFAULT ''
);
