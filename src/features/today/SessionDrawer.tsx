import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pause, Play, X } from "lucide-react";
import { getDb } from "../../db/client";
import { focusSeconds, getNote, logFocus, saveNote, setDone, setTopic, topicsFor, type SessionRow } from "../../db/today";

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h ? `${h}:${String(m).padStart(2, "0")}` : m}:${String(s % 60).padStart(2, "0")}`;
};

function Notes({ sessionId, initial }: { sessionId: number; initial: string }) {
  const [text, setText] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(initial);
  const save = async () => saveNote(await getDb(), sessionId, latest.current);
  useEffect(() => () => void (timer.current && (clearTimeout(timer.current), save())), []); // flush a pending edit on close
  return (
    <textarea
      aria-label="Notes (markdown)"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        latest.current = e.target.value;
        clearTimeout(timer.current);
        timer.current = setTimeout(() => ((timer.current = undefined), save()), 600);
      }}
      className="num min-h-40 w-full resize-y rounded-sm border border-line bg-bg p-2 text-[13px]"
      placeholder="Notes…"
    />
  );
}

function Timer({ sessionId }: { sessionId: number }) {
  const qc = useQueryClient();
  const { data: saved = 0 } = useQuery({ queryKey: ["focus", sessionId], queryFn: async () => focusSeconds(await getDb(), sessionId) });
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const started = useRef<number | null>(null);
  started.current = startedAt;
  useEffect(() => {
    if (startedAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  const start = () => {
    setNow(Date.now());
    setStartedAt(Date.now());
  };
  const stop = async () => {
    const s = started.current;
    if (s == null) return;
    started.current = null;
    setStartedAt(null);
    const secs = Math.floor((Date.now() - s) / 1000);
    if (secs > 0) await logFocus(await getDb(), sessionId, s, secs);
    qc.invalidateQueries({ queryKey: ["focus", sessionId] });
  };
  useEffect(() => () => void stop(), []); // log a running timer when the drawer closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || (e.target as HTMLElement).closest("textarea,input,button")) return;
      e.preventDefault();
      started.current == null ? start() : stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const total = saved + (startedAt ? Math.floor((now - startedAt) / 1000) : 0);
  return (
    <div className="flex items-center gap-3">
      <button
        className="press flex h-8 w-8 items-center justify-center rounded-sm bg-accent text-accent-fg"
        aria-label={startedAt ? "Pause focus timer" : "Start focus timer"}
        onClick={() => (startedAt ? stop() : start())}
      >
        {startedAt ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <span className="num text-[20px]">{clock(total)}</span>
      <span className="text-muted">focused · Space toggles</span>
    </div>
  );
}

export function SessionDrawer({ session, onClose, onChanged }: { session: SessionRow; onClose: () => void; onChanged: () => void }) {
  const qc = useQueryClient();
  const topics = useQuery({ queryKey: ["topics", session.module_id], queryFn: async () => topicsFor(await getDb(), session.module_id) });
  const note = useQuery({ queryKey: ["note", session.id], queryFn: async () => getNote(await getDb(), session.id), staleTime: Infinity, gcTime: 0 });
  const done = session.status === "done";

  const toggleDone = async () => {
    await setDone(await getDb(), session.id, !done);
    onChanged();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "x" && !(e.target as HTMLElement).closest("textarea,input")) toggleDone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <aside aria-label="Session detail" className="flex w-[420px] shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-surface p-5 max-[1100px]:w-80">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-[16px] font-semibold">{session.title}</h2>
        <button className="press rounded-sm p-1 text-muted hover:text-text" aria-label="Close (Esc)" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <Timer sessionId={session.id} />
      <button className="press self-start rounded-sm border border-line px-3 py-1.5" onClick={toggleDone}>
        {done ? "Mark not done" : "Mark done"} <kbd className="num ml-1 text-muted">x</kbd>
      </button>
      <section>
        <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted">Topics</h3>
        {topics.data?.length ? (
          <ul className="flex flex-col gap-2">
            {topics.data.map((t) => (
              <li key={t.id}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 accent-accent"
                    checked={!!t.done}
                    onChange={async (e) => {
                      await setTopic(await getDb(), t.id, e.target.checked);
                      qc.invalidateQueries({ queryKey: ["topics", session.module_id] });
                    }}
                  />
                  <span className="min-w-0 break-words">
                    {t.label}
                    {t.detail && <span className="block text-[12px] text-muted">{t.detail}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No topics for this module.</p>
        )}
      </section>
      <section>
        <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted">Notes</h3>
        {note.isSuccess ? <Notes sessionId={session.id} initial={note.data} /> : <p className="text-muted">Loading…</p>}
      </section>
    </aside>
  );
}
