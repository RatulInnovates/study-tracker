import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";

/** Every AI feature shells out to the user's own `claude` CLI, so show whether it is installed and signed in. */
export function ClaudeStatus() {
  const { data, error, isPending, refetch, isFetching } = useQuery({ queryKey: ["claude-check"], queryFn: () => invoke<string>("claude_check"), retry: false, staleTime: Infinity });
  return (
    <div className="space-y-1.5">
      <p role="status">
        {isPending ? "Checking for Claude Code…" : error ? <span className="text-danger">Claude Code not found</span> : <>Claude Code found <span className="num text-muted">({data})</span></>}
      </p>
      {error && (
        <div className="space-y-1 text-muted">
          <p>AI features (reviews, quizzes, interview practice, resume bullets) run through Claude Code on your own Claude account. Everything else works without it.</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>Install it: <code className="num">npm install -g @anthropic-ai/claude-code</code></li>
            <li>Run <code className="num">claude</code> once in a terminal and sign in with your Claude Pro or Max account.</li>
          </ol>
          <button className="press rounded-sm border border-line bg-raised px-3 py-1.5 text-[13px] text-text disabled:opacity-50" disabled={isFetching} onClick={() => refetch()}>Check again</button>
        </div>
      )}
    </div>
  );
}
