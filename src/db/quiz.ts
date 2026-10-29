import type { Db } from "./types";
import { schedule, type CardState, type Rating } from "../domain/fsrs";
import type { Difficulty, Question, Result } from "../domain/quiz";

export interface QuizSession {
  id: number;
  seq: number;
  title: string;
  status: string;
  module_title: string;
  outcome: string;
  area: string; // level title, reused as the card area
}
export interface Card extends CardState {
  id: number;
  area: string;
  front: string;
  back: string;
}
export interface Quiz {
  id: number;
  difficulty: Difficulty;
  questions: Question[];
}

export const quizSessions = (db: Db) =>
  db.select<QuizSession>(
    `SELECT s.id, s.seq, s.title, s.status, m.title module_title, m.outcome, l.title area
     FROM sessions s JOIN modules m ON m.id = s.module_id JOIN levels l ON l.id = m.level_id
     ORDER BY (s.status = 'done') DESC, s.completed_at DESC, s.seq`,
  );

export const topicLabels = async (db: Db, sessionId: number) =>
  (await db.select<{ label: string }>("SELECT t.label FROM topics t JOIN sessions s ON s.module_id = t.module_id WHERE s.id = ? ORDER BY t.seq", [sessionId])).map((r) => r.label);

export async function recentScores(db: Db, sessionId: number, n = 3) {
  const rows = await db.select<{ score: number }>(
    "SELECT a.score FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE q.session_id = ? ORDER BY a.id DESC LIMIT ?",
    [sessionId, n],
  );
  return rows.map((r) => r.score);
}

export async function saveQuiz(db: Db, sessionId: number, difficulty: Difficulty, questions: Question[], now = new Date().toISOString()): Promise<Quiz> {
  await db.execute("INSERT INTO quizzes (session_id, difficulty, questions_json, created_at) VALUES (?, ?, ?, ?)", [sessionId, difficulty, JSON.stringify(questions), now]);
  const [{ id }] = await db.select<{ id: number }>("SELECT MAX(id) id FROM quizzes");
  return { id, difficulty, questions };
}

/** Stores the attempt and turns every wrong answer into a recall card (due now; same front in the same area is kept once). */
export async function saveAttempt(db: Db, quizId: number, area: string, questions: Question[], answers: string[], results: Result[], score: number, now = new Date().toISOString()) {
  await db.execute("INSERT INTO quiz_attempts (quiz_id, answers_json, results_json, score, taken_at) VALUES (?, ?, ?, ?, ?)", [quizId, JSON.stringify(answers), JSON.stringify(results), score, now]);
  for (const [i, q] of questions.entries()) {
    if (results[i].correct) continue;
    await db.execute(
      "INSERT OR IGNORE INTO cards (area, front, back, source, due, created_at) VALUES (?, ?, ?, 'quiz', ?, ?)",
      [area, q.prompt, q.explanation ? `${q.answer}\n\n${q.explanation}` : q.answer, now, now],
    );
  }
}

export const DAILY_CAP = 15;

export const dueCards = (db: Db, now = new Date().toISOString(), limit = DAILY_CAP) =>
  db.select<Card>("SELECT id, area, front, back, due, stability, difficulty, reps, lapses, last_review FROM cards WHERE due <= ? ORDER BY due LIMIT ?", [now, limit]);

export const cardCounts = async (db: Db, now = new Date().toISOString()) =>
  (await db.select<{ total: number; due: number }>("SELECT COUNT(*) total, COALESCE(SUM(due <= ?), 0) due FROM cards", [now]))[0];

export async function reviewCard(db: Db, card: CardState & { id: number }, rating: Rating, now = new Date()) {
  const n = schedule(card, rating, now);
  await db.execute("UPDATE cards SET due = ?, stability = ?, difficulty = ?, reps = ?, lapses = ?, last_review = ? WHERE id = ?", [n.due, n.stability, n.difficulty, n.reps, n.lapses, n.last_review, card.id]);
  await db.execute("INSERT INTO card_reviews (card_id, rating, reviewed_at) VALUES (?, ?, ?)", [card.id, rating, now.toISOString()]);
}
