import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { askParsed } from "../../ai/claude";
import { getDb } from "../../db/client";
import { benchmarksFor, dodFor, listProjects } from "../../db/projects";
import { buildBulletsPrompt, buildReadme, parseBullets, type PortfolioInput } from "../../domain/portfolio";
import { EmptyState } from "../../ui/EmptyState";
import { PageHeader } from "../../ui/PageHeader";

const btn = "press flex items-center gap-2 rounded-sm border border-line px-3 py-1.5 hover:bg-raised disabled:opacity-40";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const copy = (text: string) =>
  navigator.clipboard.writeText(text).then(() => toast.success("Copied"), (e) => toast.error(`Copy failed: ${errMsg(e)}`));

export function Portfolio() {
  const [id, setId] = useState<number | null>(null);
  const projects = useQuery({ queryKey: ["portfolio-projects"], queryFn: async () => (await listProjects(await getDb())).filter((p) => p.status === "shipped") });
  const picked = projects.data?.find((p) => p.id === id) ?? projects.data?.[0];

  const detail = useQuery({
    queryKey: ["portfolio", picked?.id],
    enabled: !!picked,
    queryFn: async (): Promise<PortfolioInput> => {
      const db = await getDb();
      return { ...picked!, dod: await dodFor(db, picked!.id), benchmarks: await benchmarksFor(db, picked!.id) };
    },
  });
  const bullets = useMutation({ mutationFn: () => askParsed(buildBulletsPrompt(detail.data!), parseBullets) });

  return (
    <>
      <PageHeader title="Portfolio" subtitle="Shipped capstones as a README summary and resume bullets" />
      {projects.data && !projects.data.length ? (
        <EmptyState title="No shipped projects yet" hint="Mark a capstone as shipped on the Projects page." />
      ) : (
        <div className="flex gap-6 px-8 py-6 max-[900px]:flex-col">
          <ul className="w-56 shrink-0 space-y-0.5 max-[900px]:w-full" aria-label="Shipped projects">
            {projects.data?.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => { setId(p.id); bullets.reset(); }}
                  aria-current={p.id === picked?.id}
                  title={p.title}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-raised ${p.id === picked?.id ? "bg-raised" : ""}`}
                >
                  <span className="num w-8 text-[12px] text-muted">L{p.level_num}</span>
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                </button>
              </li>
            ))}
          </ul>
          {detail.data && (
            <div className="min-w-0 flex-1 space-y-6">
              <section aria-labelledby="readme" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 id="readme" className="font-semibold">README summary</h2>
                  <button className={btn} onClick={() => copy(buildReadme(detail.data))}><Copy size={14} aria-hidden />Copy</button>
                </div>
                <pre className="num whitespace-pre-wrap break-words rounded-md border border-line bg-surface p-3 text-[13px]">{buildReadme(detail.data)}</pre>
              </section>
              <section aria-labelledby="bullets" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 id="bullets" className="font-semibold">Resume bullets</h2>
                  <button className={btn} disabled={bullets.isPending} onClick={() => bullets.mutate()}>
                    {bullets.isPending && <Loader2 size={14} className="animate-spin" aria-hidden />}
                    {bullets.data ? "Regenerate" : "Generate"}
                  </button>
                </div>
                {bullets.error && <p role="alert" className="text-danger">{errMsg(bullets.error)}</p>}
                {bullets.data && (
                  <>
                    <ul className="list-disc space-y-1.5 rounded-md border border-line bg-surface p-3 pl-7">
                      {bullets.data.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                    <button className={btn} onClick={() => copy(bullets.data.map((b) => `- ${b}`).join("\n"))}><Copy size={14} aria-hidden />Copy bullets</button>
                  </>
                )}
              </section>
            </div>
          )}
        </div>
      )}
    </>
  );
}
