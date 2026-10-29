import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { getDb } from "../../db/client";
import { dodLabels, getRules, reviewTargets, reviewsFor, saveReview, setRules, type ReviewRow, type ReviewTarget } from "../../db/reviews";
import { askClaude } from "../../ai/claude";
import { buildPrompt, compareReviews, estimateTokens, finalVerdict, parseReview, type Verdict } from "../../domain/review";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";

const field = "w-full rounded-sm border border-line bg-bg px-2 py-1.5";
const VERDICT: Record<Verdict, { label: string; cls: string }> = {
  pass: { label: "Pass", cls: "text-accent" },
  needs_work: { label: "Needs work", cls: "text-text" },
  fail: { label: "Fail", cls: "text-danger" },
};
const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface Prepared {
  prompt: string;
  testOutput: string;
  testsPassed: boolean | null;
  tokens: number;
}

function Setup({ p }: { p: ReviewTarget }) {
  const qc = useQueryClient();
  const { data: allow } = useQuery({ queryKey: ["allowlist", p.id], queryFn: () => invoke<string[]>("get_allowlist", { projectId: p.id }) });
  const { data: rules } = useQuery({ queryKey: ["rules", p.id], queryFn: async () => getRules(await getDb(), p.id) });
  if (allow === undefined || rules === undefined) return null;
  return (
    <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
      <label className="block">
        <span className="text-[12px] text-muted">Allowed commands (one per line, run in the repo before review; stored outside backups)</span>
        <textarea
          key={allow.join("\n")}
          defaultValue={allow.join("\n")}
          rows={3}
          placeholder="pytest -q"
          onBlur={async (e) => {
            await invoke("set_allowlist", { projectId: p.id, commands: lines(e.target.value) });
            qc.invalidateQueries({ queryKey: ["allowlist", p.id] });
          }}
          className={`${field} num`}
        />
      </label>
      <label className="block">
        <span className="text-[12px] text-muted">Custom rules (one per line)</span>
        <textarea
          key={rules}
          defaultValue={rules}
          rows={3}
          placeholder="must use raw SQL"
          onBlur={async (e) => {
            await setRules(await getDb(), p.id, lines(e.target.value).join("\n"));
            qc.invalidateQueries({ queryKey: ["rules", p.id] });
          }}
          className={field}
        />
      </label>
    </div>
  );
}

function Result({ r, prev }: { r: ReviewRow; prev?: ReviewRow }) {
  const cmp = prev && compareReviews(prev, r);
  return (
    <section className="space-y-3 rounded-md border border-line bg-surface p-4">
      <div className="flex items-baseline gap-3">
        <span className={`text-[16px] font-semibold ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
        <span className="num">{r.score}/100</span>
        {cmp && <span className="num text-muted">{cmp.scoreDelta >= 0 ? "+" : ""}{cmp.scoreDelta} vs previous · {cmp.resolved.length} resolved · {cmp.added.length} new</span>}
        <span className="num ml-auto text-[12px] text-muted">{r.created_at.slice(0, 16).replace("T", " ")}</span>
      </div>
      {r.tests_passed !== null && <p className={r.tests_passed ? "text-muted" : "text-danger"}>Commands {r.tests_passed ? "passed" : "failed, so the verdict is forced to fail"}.</p>}
      {r.summary && <p className="break-words">{r.summary}</p>}
      {r.missing.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Missing requirements</h3>
          <ul className="list-disc space-y-0.5 pl-5">{r.missing.map((m, i) => <li key={i} className="break-words">{m}</li>)}</ul>
        </div>
      )}
      {r.issues.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Issues</h3>
          <ul className="space-y-2">
            {r.issues.map((i, n) => (
              <li key={n} className="border-l-2 border-line pl-3">
                <p className="num break-all text-[12px] text-muted">{i.severity} · {i.file}{i.line ? `:${i.line}` : ""}</p>
                <p className="break-words">{i.message}</p>
                {i.fix && <p className="break-words text-muted">Fix: {i.fix}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cmp && cmp.resolved.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Resolved since last review</h3>
          <ul className="list-disc pl-5 text-muted">{cmp.resolved.map((i, n) => <li key={n} className="break-words">{i.file}: {i.message}</li>)}</ul>
        </div>
      )}
      {r.test_output && (
        <details>
          <summary className="cursor-pointer text-muted">Command output</summary>
          <pre className="num mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[12px]">{r.test_output}</pre>
        </details>
      )}
    </section>
  );
}

function Reviewer({ p }: { p: ReviewTarget }) {
  const qc = useQueryClient();
  const [base, setBase] = useState("HEAD");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const { data: history = [] } = useQuery({ queryKey: ["reviews", p.id], queryFn: async () => reviewsFor(await getDb(), p.id) });

  const prepare = useMutation({
    mutationFn: async () => {
      const db = await getDb();
      const repo = p.repo_path!;
      const commands = await invoke<string[]>("get_allowlist", { projectId: p.id });
      let testOutput = "";
      let testsPassed: boolean | null = null;
      for (const command of commands) {
        const r = await invoke<{ code: number; output: string }>("run_allowed", { projectId: p.id, repo, command }).catch((e) => ({ code: -1, output: errMsg(e) }));
        testsPassed = (testsPassed ?? true) && r.code === 0;
        testOutput += `### $ ${command} (exit ${r.code})\n${r.output}\n`;
      }
      const context = await invoke<string>("repo_context", { repo, base: base.trim() });
      const prompt = buildPrompt({ title: p.title, result: p.result, dod: await dodLabels(db, p.id), rules: lines(await getRules(db, p.id)), context, testOutput });
      setPrepared({ prompt, testOutput, testsPassed, tokens: estimateTokens(prompt) });
    },
  });

  const send = useMutation({
    mutationFn: async (pr: Prepared) => {
      let model;
      try {
        model = parseReview(await askClaude(pr.prompt));
      } catch (first) {
        // one retry with the validation error quoted
        model = parseReview(await askClaude(`${pr.prompt}\n\nYour previous reply was rejected: ${errMsg(first)}. Reply with ONLY the JSON object.`));
      }
      await saveReview(await getDb(), p.id, finalVerdict(model.verdict, pr.testsPassed), model, pr.testOutput, pr.testsPassed);
    },
    onSuccess: () => {
      setPrepared(null);
      qc.invalidateQueries({ queryKey: ["reviews", p.id] });
    },
  });

  const busy = prepare.isPending || send.isPending;
  const error = prepare.error ?? send.error;
  return (
    <div className="space-y-4">
      <Setup p={p} />
      <div className="flex items-end gap-2">
        <label className="block w-48">
          <span className="text-[12px] text-muted">Diff against</span>
          <input value={base} onChange={(e) => { setBase(e.target.value); setPrepared(null); }} className={`${field} num`} />
        </label>
        <button disabled={busy || !p.repo_path || !base.trim()} onClick={() => (send.reset(), prepare.mutate())} className="press rounded-sm border border-line px-3 py-1.5 hover:bg-raised disabled:opacity-40">
          {prepare.isPending ? "Running commands…" : "Prepare review"}
        </button>
        {prepared && (
          <button disabled={busy} onClick={() => send.mutate(prepared)} className="press flex items-center gap-2 rounded-sm bg-accent px-3 py-1.5 text-accent-fg disabled:opacity-60">
            {send.isPending && <Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />}
            {send.isPending ? "Reviewing (about 10s)…" : `Send to Claude (~${prepared.tokens.toLocaleString()} tokens)`}
          </button>
        )}
      </div>
      {!p.repo_path && <p className="text-muted">Set a repo path for this project on the Projects page first.</p>}
      {error && <p role="alert" className="num whitespace-pre-wrap break-words text-danger">{errMsg(error)}</p>}
      {history.length === 0 ? <p className="text-muted">No reviews yet.</p> : <Result r={history[0]} prev={history[1]} />}
      {history.length > 1 && (
        <section>
          <h3 className="mb-1 font-medium">History</h3>
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="num flex gap-3 py-1.5 text-[12px]">
                <span className="w-32 text-muted">{h.created_at.slice(0, 16).replace("T", " ")}</span>
                <span className={`w-24 ${VERDICT[h.verdict].cls}`}>{VERDICT[h.verdict].label}</span>
                <span>{h.score}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function Review() {
  const [id, setId] = useState<number | null>(null);
  const { data } = useQuery({ queryKey: ["review-targets"], queryFn: async () => reviewTargets(await getDb()) });
  const p = data?.find((t) => t.id === id) ?? data?.[0];
  return (
    <div>
      <PageHeader title="Review" subtitle="Run your checks, then have Claude grade the diff against the rubric" />
      <div className="max-w-4xl space-y-4 p-8">
        {data && data.length === 0 && <EmptyState title="No capstones found" hint="The roadmap seed has not been loaded." />}
        {p && (
          <>
            <label className="block">
              <span className="text-[12px] text-muted">Project</span>
              <select value={p.id} onChange={(e) => setId(Number(e.target.value))} className={field}>
                {data!.map((t) => <option key={t.id} value={t.id}>L{t.level_num} · {t.title}</option>)}
              </select>
              <span className="num mt-1 block truncate text-[12px] text-muted" title={p.repo_path ?? undefined}>{p.repo_path || "no repo linked"}</span>
            </label>
            <Reviewer key={p.id} p={p} />
          </>
        )}
      </div>
    </div>
  );
}
