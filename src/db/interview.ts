import type { Feedback, Kind } from "../domain/interview";
import type { Db } from "./types";

export interface Attempt {
  id: number;
  kind: Kind;
  area: string;
  question: string;
  answer: string;
  seconds: number;
  score: number;
  feedback: Feedback;
  created_at: string;
}
export interface Story {
  id: number;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
}

export const saveAttempt = (db: Db, a: Omit<Attempt, "id" | "created_at">, now = new Date().toISOString()) =>
  db.execute("INSERT INTO interview_attempts (kind, area, question, answer, seconds, score, feedback_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [a.kind, a.area, a.question, a.answer, a.seconds, a.score, JSON.stringify(a.feedback), now]);

export async function recentAttempts(db: Db, limit = 30): Promise<Attempt[]> {
  const rows = await db.select<Attempt & { feedback_json: string }>("SELECT * FROM interview_attempts ORDER BY id DESC LIMIT ?", [limit]);
  return rows.map(({ feedback_json, ...r }) => ({ ...r, feedback: JSON.parse(feedback_json) }));
}

export const recentQuestions = async (db: Db, area: string, kind: Kind, n = 8) =>
  (await db.select<{ question: string }>("SELECT question FROM interview_attempts WHERE area = ? AND kind = ? ORDER BY id DESC LIMIT ?", [area, kind, n])).map((r) => r.question);

export const stories = (db: Db) => db.select<Story>("SELECT id, title, situation, task, action, result FROM stories ORDER BY id DESC");

export const addStory = (db: Db, title: string, now = new Date().toISOString()) => db.execute("INSERT INTO stories (title, created_at) VALUES (?, ?)", [title, now]);

export const updateStory = (db: Db, s: Story) =>
  db.execute("UPDATE stories SET title = ?, situation = ?, task = ?, action = ?, result = ? WHERE id = ?", [s.title, s.situation, s.task, s.action, s.result, s.id]);

export const deleteStory = (db: Db, id: number) => db.execute("DELETE FROM stories WHERE id = ?", [id]);
