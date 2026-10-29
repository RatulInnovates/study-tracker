import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getDb } from "../../db/client";
import { cardCounts, DAILY_CAP, dueCards, quizSessions, recentScores, reviewCard, saveAttempt, saveQuiz, topicLabels, type Card, type Quiz, type QuizSession } from "../../db/quiz";
import { askClaude } from "../../ai/claude";
import type { Rating } from "../../domain/fsrs";
import { buildGradePrompt, buildQuizPrompt, nextDifficulty, parseGrades, parseQuiz, scorePct, type Question, type Result } from "../../domain/quiz";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const btn = "press rounded-sm border border-line px-3 py-1.5 hover:bg-raised disabled:opacity-40";
const primary = "press flex items-center gap-2 rounded-sm bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-60";

/** One retry with the validation error quoted, like the reviewer. */
async function askParsed<T>(prompt: string, parse: (text: string) => T): Promise<T> {
  try {
    return parse(await askClaude(prompt));
  } catch (first) {
    return parse(await askClaude(`${prompt}\n\nYour previous reply was rejected: ${errMsg(first)}. Reply with ONLY the JSON object.`));
  }
}

function QuizTab() {
  const qc = useQueryClient();
  const { data: sessions } = useQuery({ queryKey: ["quiz-sessions"], queryFn: async () => quizSessions(await getDb()) });
  const [sid, setSid] = useState<number | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [graded, setGraded] = useState<{ results: Result[]; score: number } | null>(null);
  const s: QuizSession | undefined = sessions?.find((x) => x.id === sid) ?? sessions?.[0];

  const generate = useMutation({
    mutationFn: async (s: QuizSession) => {
      const db = await getDb();
      const difficulty = nextDifficulty(await recentScores(db, s.id));
      const questions = await askParsed(buildQuizPrompt({ title: s.title, module: s.module_title, outcome: s.outcome, topics: await topicLabels(db, s.id), difficulty }), parseQuiz);
      const q = await saveQuiz(db, s.id, difficulty, questions);
      setQuiz(q);
      setAnswers(questions.map(() => ""));
      setGraded(null);
    },
  });

  const grade = useMutation({
    mutationFn: async ({ s, quiz }: { s: QuizSession; quiz: Quiz }) => {
      const shorts = quiz.questions.flatMap((question, index) => (question.type === "short" ? [{ index, question, given: answers[index] }] : []));
      const byModel = shorts.length ? await askParsed(buildGradePrompt(shorts), (t) => parseGrades(t, shorts.map((x) => x.index))) : new Map<number, Result>();
      const results = quiz.questions.map((q, i): Result => (q.type === "mcq" ? { correct: answers[i] === q.answer, feedback: "" } : byModel.get(i)!));
      const score = scorePct(results);
      await saveAttempt(await getDb(), quiz.id, s.area, quiz.questions, answers, results, score);
      setGraded({ results, score });
      qc.invalidateQueries({ queryKey: ["card-counts"] });
    },
  });

  if (sessions === undefined) return null;
  if (!s) return <EmptyState title="No sessions yet" />;
  const busy = generate.isPending || grade.isPending;
  const error = generate.error ?? grade.error;
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <label className="block min-w-0 flex-1">
          <span className="text-[12px] text-muted">Session (completed ones first)</span>
          <select
            value={s.id}
            onChange={(e) => (setSid(Number(e.target.value)), setQuiz(null), setGraded(null))}
            className="w-full rounded-sm border border-line bg-bg px-2 py-1.5"
          >
            {sessions.map((x) => (
              <option key={x.id} value={x.id}>{`${x.status === "done" ? "✓ " : ""}${x.seq}. ${x.title}`}</option>
            ))}
          </select>
        </label>
        <button disabled={busy} onClick={() => (grade.reset(), generate.mutate(s))} className={primary}>
          {generate.isPending && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />}
          {generate.isPending ? "Writing quiz (about 10s)…" : quiz ? "New quiz" : "Generate quiz"}
        </button>
      </div>
      {error && <p role="alert" className="num whitespace-pre-wrap break-words text-danger">{errMsg(error)}</p>}
      {quiz && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            grade.mutate({ s, quiz });
          }}
        >
          <p className="num text-[12px] text-muted">Difficulty: {quiz.difficulty}</p>
          {quiz.questions.map((q, i) => (
            <QuestionView key={i} n={i} q={q} value={answers[i] ?? ""} result={graded?.results[i]} locked={!!graded || busy} onChange={(v) => setAnswers((a) => a.map((x, j) => (j === i ? v : x)))} />
          ))}
          {graded ? (
            <p className="font-medium">
              Score <span className="num">{graded.score}%</span>
              <span className="font-normal text-muted"> · wrong answers were added to your cards</span>
            </p>
          ) : (
            <button type="submit" disabled={busy} className={primary}>
              {grade.isPending && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />}
              {grade.isPending ? "Grading…" : "Submit answers"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function QuestionView({ n, q, value, result, locked, onChange }: { n: number; q: Question; value: string; result?: Result; locked: boolean; onChange: (v: string) => void }) {
  return (
    <fieldset disabled={locked} className="space-y-2 rounded-md border border-line bg-surface p-4">
      <legend className="sr-only">Question {n + 1}</legend>
      <p className="break-words font-medium">{n + 1}. {q.prompt}</p>
      {q.type === "mcq" ? (
        <div className="space-y-1">
          {q.options.map((o) => (
            <label key={o} className="flex cursor-pointer items-start gap-2">
              <input type="radio" name={`q${n}`} checked={value === o} onChange={() => onChange(o)} className="mt-1" />
              <span className="break-words">{o}</span>
            </label>
          ))}
        </div>
      ) : (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} aria-label={`Answer to question ${n + 1}`} className="w-full rounded-sm border border-line bg-bg px-2 py-1.5" />
      )}
      {result && (
        <div className="border-l-2 border-line pl-3">
          <p className={result.correct ? "text-accent" : "text-danger"}>{result.correct ? "Correct" : "Not quite"}</p>
          {!result.correct && <p className="break-words text-muted">Answer: {q.answer}</p>}
          {result.feedback && <p className="break-words text-muted">{result.feedback}</p>}
          {q.explanation && <p className="break-words text-muted">{q.explanation}</p>}
        </div>
      )}
    </fieldset>
  );
}

const RATINGS: [Rating, string][] = [[1, "Again"], [2, "Hard"], [3, "Good"], [4, "Easy"]];

function CardsTab() {
  const qc = useQueryClient();
  const { data: queue } = useQuery({ queryKey: ["due-cards"], queryFn: async () => dueCards(await getDb()) });
  const [shown, setShown] = useState(false);
  const card: Card | undefined = queue?.[0];

  const rate = useMutation({
    mutationFn: async ([c, r]: [Card, Rating]) => reviewCard(await getDb(), c, r),
    onSuccess: async () => {
      setShown(false);
      await qc.invalidateQueries({ queryKey: ["due-cards"] });
      qc.invalidateQueries({ queryKey: ["card-counts"] });
    },
  });

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
      if (e.key === " " || e.key === "Enter") (e.preventDefault(), setShown(true));
      else if (shown && !rate.isPending && "1234".includes(e.key)) rate.mutate([card, Number(e.key) as Rating]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, shown, rate]);

  if (queue === undefined) return null;
  if (!card) return <EmptyState title="No cards due" hint="Wrong quiz answers show up here as recall cards." />;
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="num text-[12px] text-muted">{queue.length} due (daily cap {DAILY_CAP}) · {card.area}</p>
      <section className="space-y-3 rounded-md border border-line bg-surface p-5">
        <p className="whitespace-pre-wrap break-words font-medium">{card.front}</p>
        {shown && <p className="whitespace-pre-wrap break-words border-t border-line pt-3">{card.back}</p>}
      </section>
      {shown ? (
        <div className="flex gap-2">
          {RATINGS.map(([r, label]) => (
            <button key={r} disabled={rate.isPending} onClick={() => rate.mutate([card, r])} className={`${btn} flex-1`}>
              {label} <kbd className="num text-[12px] text-muted">{r}</kbd>
            </button>
          ))}
        </div>
      ) : (
        <button onClick={() => setShown(true)} className={`${primary} w-full justify-center`}>
          Show answer <kbd className="num text-[12px]">Space</kbd>
        </button>
      )}
      {rate.error && <p role="alert" className="num break-words text-danger">{errMsg(rate.error)}</p>}
    </div>
  );
}

export function Quiz() {
  const [tab, setTab] = useState<"cards" | "quiz">("cards");
  const { data: counts } = useQuery({ queryKey: ["card-counts"], queryFn: async () => cardCounts(await getDb()) });
  return (
    <>
      <PageHeader
        title="Quiz & Cards"
        subtitle={counts ? `${counts.due} due · ${counts.total} cards` : undefined}
        actions={
          <div role="tablist" className="flex gap-1">
            {(["cards", "quiz"] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`press rounded-sm px-3 py-1.5 capitalize ${tab === t ? "bg-raised" : "text-muted hover:text-text"}`}>
                {t}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-8">{tab === "cards" ? <CardsTab /> : <QuizTab />}</div>
    </>
  );
}
