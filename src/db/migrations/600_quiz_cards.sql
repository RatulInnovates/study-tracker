CREATE TABLE quizzes (
  id             INTEGER PRIMARY KEY,
  session_id     INTEGER NOT NULL REFERENCES sessions(id),
  difficulty     TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  created_at     TEXT NOT NULL
);
CREATE INDEX idx_quizzes_session ON quizzes (session_id, id);

CREATE TABLE quiz_attempts (
  id           INTEGER PRIMARY KEY,
  quiz_id      INTEGER NOT NULL REFERENCES quizzes(id),
  answers_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  score        INTEGER NOT NULL, -- 0-100
  taken_at     TEXT NOT NULL
);

CREATE TABLE cards (
  id          INTEGER PRIMARY KEY,
  area        TEXT NOT NULL,
  front       TEXT NOT NULL,
  back        TEXT NOT NULL,
  source      TEXT NOT NULL DEFAULT 'quiz' CHECK (source IN ('quiz', 'manual', 'review')),
  due         TEXT NOT NULL,
  stability   REAL NOT NULL DEFAULT 0,
  difficulty  REAL NOT NULL DEFAULT 0,
  reps        INTEGER NOT NULL DEFAULT 0,
  lapses      INTEGER NOT NULL DEFAULT 0,
  last_review TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE (area, front)
);
CREATE INDEX idx_cards_due ON cards (due);

CREATE TABLE card_reviews (
  id          INTEGER PRIMARY KEY,
  card_id     INTEGER NOT NULL REFERENCES cards(id),
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at TEXT NOT NULL
);
