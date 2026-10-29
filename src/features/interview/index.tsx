import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getDb } from "../../db/client";
import { addStory, deleteStory, recentAttempts, recentQuestions, saveAttempt, stories, updateStory, type Story } from "../../db/interview";
import { askParsed } from "../../ai/claude";
import { AREAS, buildGradePrompt, buildQuestionPrompt, parseFeedback, parseQuestion, storyText, TIME_LIMIT, type Feedback, type Kind } from "../../domain/interview";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const field = "w-full rounded-sm border border-line bg-bg px-2 py-1.5";
const btn = "press rounded-sm border border-line px-3 py-1.5 hover:bg-raised disabled:opacity-40";
const primary = "press flex items-center gap-2 rounded-sm bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-60";
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function FeedbackView({ f }: { f: Feedback }) {
  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <p className="text-[12px] text-muted">{title}</p>
        <ul className="list-disc space-y-0.5 pl-5">
          {items.map((x, i) => <li key={i} className="break-words">{x}</li>)}
        </ul>
      </div>
    );
  return (
    <div className="space-y-3 border-l-2 border-line pl-3">
      <p className="font-medium">Score <span className="num">{f.score}%</span></p>
      {list("Strengths", f.strengths)}
      {list("Gaps", f.gaps)}
      <div>
        <p className="text-[12px] text-muted">Model answer</p>
        <p className="whitespace-pre-wrap break-words">{f.model_answer}</p>
      </div>
    </div>
  );
}

/** Counts up while `running`; stops at the value on submit. */
function useElapsed(running: boolean, resetKey: unknown) {
  const [s, setS] = useState(0);
  useEffect(() => setS(0), [resetKey]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return s;
}

function Practice() {
  const qc = useQueryClient();
  const [kind, setKind] = useState<Kind>("question");
  const [area, setArea] = useState<string>(AREAS[0]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const limit = TIME_LIMIT[kind];
  const elapsed = useElapsed(!!question && !feedback, question);

  const ask = useMutation({
    mutationFn: async () => {
      const prior = await recentQuestions(await getDb(), area, kind);
      setQuestion(await askParsed(buildQuestionPrompt(kind, area, prior), parseQuestion));
      setAnswer("");
      setFeedback(null);
    },
  });
  const grade = useMutation({
    mutationFn: async () => {
      const f = await askParsed(buildGradePrompt(kind, area, question!, answer), parseFeedback);
      await saveAttempt(await getDb(), { kind, area, question: question!, answer, seconds: elapsed, score: f.score, feedback: f });
      setFeedback(f);
      qc.invalidateQueries({ queryKey: ["interview-attempts"] });
    },
  });
  const busy = ask.isPending || grade.isPending;
  const error = ask.error ?? grade.error;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="text-[12px] text-muted">Type</span>
          <select value={kind} onChange={(e) => (setKind(e.target.value as Kind), setQuestion(null), setFeedback(null))} className={field}>
            <option value="question">Mock question (5 min)</option>
            <option value="design">System design (25 min)</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[12px] text-muted">Area</span>
          <select value={area} onChange={(e) => setArea(e.target.value)} className={field}>
            {AREAS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </label>
        <button disabled={busy} onClick={() => (grade.reset(), ask.mutate())} className={primary}>
          {ask.isPending && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />}
          {ask.isPending ? "Writing question (about 10s)…" : question ? "New question" : "Start"}
        </button>
      </div>
      {error && <p role="alert" className="num whitespace-pre-wrap break-words text-danger">{errMsg(error)}</p>}
      {question && (
        <form
          className="space-y-3 rounded-md border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            grade.mutate();
          }}
        >
          <p className="whitespace-pre-wrap break-words font-medium">{question}</p>
          <label className="block">
            <span className="sr-only">Your answer</span>
            <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={!!feedback || busy} rows={kind === "design" ? 14 : 7} className={field} />
          </label>
          {!feedback && (
            <div className="flex items-center gap-3">
              <button type="submit" disabled={busy || !answer.trim()} className={primary}>
                {grade.isPending && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />}
                {grade.isPending ? "Grading…" : "Submit answer"}
              </button>
              <span className={`num ${elapsed > limit ? "text-danger" : "text-muted"}`} aria-label="Elapsed time">{clock(elapsed)} / {clock(limit)}</span>
            </div>
          )}
          {feedback && <FeedbackView f={feedback} />}
        </form>
      )}
    </div>
  );
}

function History() {
  const { data } = useQuery({ queryKey: ["interview-attempts"], queryFn: async () => recentAttempts(await getDb()) });
  if (data === undefined) return null;
  if (!data.length) return <EmptyState title="No attempts yet" hint="Graded answers show up here." />;
  return (
    <ul className="mx-auto max-w-2xl space-y-2">
      {data.map((a) => (
        <li key={a.id}>
          <details className="rounded-md border border-line bg-surface p-3">
            <summary className="flex cursor-pointer items-center gap-3">
              <span className="num w-10 shrink-0 text-right">{a.score}%</span>
              <span className="min-w-0 flex-1 truncate">{a.question}</span>
              <span className="num shrink-0 text-[12px] text-muted">{a.area} · {a.kind === "design" ? "design" : "question"} · {clock(a.seconds)} · {a.created_at.slice(0, 10)}</span>
            </summary>
            <div className="mt-3 space-y-3">
              <p className="whitespace-pre-wrap break-words text-muted">{a.answer}</p>
              <FeedbackView f={a.feedback} />
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

function StoryCard({ s, onSaved }: { s: Story; onSaved: () => void }) {
  const [d, setD] = useState(s);
  const [copied, setCopied] = useState(false);
  const save = useMutation({ mutationFn: async () => updateStory(await getDb(), d), onSuccess: onSaved });
  const remove = useMutation({ mutationFn: async () => deleteStory(await getDb(), s.id), onSuccess: onSaved });
  const set = (k: keyof Story) => (e: { target: { value: string } }) => setD({ ...d, [k]: e.target.value });
  return (
    <section className="space-y-2 rounded-md border border-line bg-surface p-4">
      <input value={d.title} onChange={set("title")} aria-label="Story title" className={`${field} font-medium`} />
      {(["situation", "task", "action", "result"] as const).map((k) => (
        <label key={k} className="block">
          <span className="text-[12px] capitalize text-muted">{k}</span>
          <textarea value={d[k]} onChange={set(k)} rows={2} className={field} />
        </label>
      ))}
      <div className="flex gap-2">
        <button disabled={save.isPending || !d.title.trim()} onClick={() => save.mutate()} className={primary}>Save</button>
        <button
          className={btn}
          onClick={() => navigator.clipboard.writeText(storyText(d)).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)), () => {})}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          disabled={remove.isPending}
          onClick={() => window.confirm(`Delete "${s.title}"?`) && remove.mutate()}
          className={`${btn} ml-auto text-danger`}
        >
          Delete
        </button>
      </div>
      {(save.error ?? remove.error) && <p role="alert" className="num break-words text-danger">{errMsg(save.error ?? remove.error)}</p>}
    </section>
  );
}

function Stories() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["stories"], queryFn: async () => stories(await getDb()) });
  const [title, setTitle] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["stories"] });
  const add = useMutation({
    mutationFn: async () => addStory(await getDb(), title.trim()),
    onSuccess: () => (setTitle(""), refresh()),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim()) add.mutate();
        }}
      >
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New story, e.g. Cut RAG latency by 40%" aria-label="New story title" className={field} />
        <button type="submit" disabled={add.isPending || !title.trim()} className={primary}>Add</button>
      </form>
      {add.error && <p role="alert" className="num break-words text-danger">{errMsg(add.error)}</p>}
      {data === undefined ? null : data.length === 0 ? (
        <EmptyState title="No stories yet" hint="Write your STAR stories once, reuse them in every interview." />
      ) : (
        data.map((s) => <StoryCard key={s.id} s={s} onSaved={refresh} />)
      )}
    </div>
  );
}

const TABS = { practice: "Practice", history: "History", stories: "STAR stories" } as const;

export function Interview() {
  const [tab, setTab] = useState<keyof typeof TABS>("practice");
  return (
    <>
      <PageHeader
        title="Interview prep"
        actions={
          <div role="tablist" className="flex gap-1">
            {(Object.keys(TABS) as (keyof typeof TABS)[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`press rounded-sm px-3 py-1.5 ${tab === t ? "bg-raised" : "text-muted hover:text-text"}`}>
                {TABS[t]}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-8">{tab === "practice" ? <Practice /> : tab === "history" ? <History /> : <Stories />}</div>
    </>
  );
}
