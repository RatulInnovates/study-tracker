export type Rating = 1 | 2 | 3 | 4; // again, hard, good, easy

export interface CardState {
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  due: string;
  last_review: string | null;
}

// FSRS-4.5 default weights.
const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
const clampD = (d: number) => Math.min(10, Math.max(1, d));

export const retrievability = (elapsedDays: number, stability: number) => (1 + (FACTOR * elapsedDays) / stability) ** DECAY;

/** Next review state for a rating. Target retention is 90%, so the interval equals the new stability. */
export function schedule(c: CardState, rating: Rating, now: Date): CardState {
  let stability: number;
  let difficulty: number;
  let lapses = c.lapses;
  if (c.reps === 0) {
    stability = W[rating - 1];
    difficulty = clampD(W[4] - (rating - 3) * W[5]);
    if (rating === 1) lapses++;
  } else {
    const elapsed = c.last_review ? Math.max(0, (now.getTime() - new Date(c.last_review).getTime()) / DAY) : c.stability;
    const r = retrievability(elapsed, c.stability);
    difficulty = clampD(W[7] * W[4] + (1 - W[7]) * (c.difficulty - W[6] * (rating - 3)));
    if (rating === 1) {
      lapses++;
      stability = Math.min(c.stability, W[11] * difficulty ** -W[12] * ((c.stability + 1) ** W[13] - 1) * Math.exp((1 - r) * W[14]));
    } else {
      const bonus = (rating === 2 ? W[15] : 1) * (rating === 4 ? W[16] : 1);
      stability = c.stability * (1 + Math.exp(W[8]) * (11 - difficulty) * c.stability ** -W[9] * (Math.exp((1 - r) * W[10]) - 1) * bonus);
    }
  }
  stability = Math.max(0.1, stability);
  const days = rating === 1 ? 1 : Math.max(1, Math.round(stability));
  return { stability, difficulty, reps: c.reps + 1, lapses, due: new Date(now.getTime() + days * DAY).toISOString(), last_review: now.toISOString() };
}
