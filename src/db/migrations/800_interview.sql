CREATE TABLE interview_attempts (
  id            INTEGER PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('question', 'design')),
  area          TEXT NOT NULL,
  question      TEXT NOT NULL,
  answer        TEXT NOT NULL,
  seconds       INTEGER NOT NULL,
  score         INTEGER NOT NULL, -- 0-100
  feedback_json TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE TABLE stories (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  situation  TEXT NOT NULL DEFAULT '',
  task       TEXT NOT NULL DEFAULT '',
  action     TEXT NOT NULL DEFAULT '',
  result     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
