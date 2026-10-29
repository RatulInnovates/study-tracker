import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Command } from "cmdk";
import { useLocation } from "wouter";
import { getDb } from "../db/client";
import { loadRoadmap } from "../db/roadmap";
import { NAV } from "./nav";

// `g` then one of these jumps to a page.
const GO: Record<string, string> = { t: "/", r: "/roadmap", p: "/projects", v: "/review", q: "/quiz", a: "/analytics", i: "/interview", s: "/settings" };
const keyOf = (path: string) => Object.entries(GO).find(([, p]) => p === path)?.[0];
const typing = (t: EventTarget | null) => !!(t as HTMLElement | null)?.closest?.("input,textarea,select,[contenteditable]");

export function CommandPalette({ open, setOpen }: { open: boolean; setOpen: (v: boolean | ((o: boolean) => boolean)) => void }) {
  const [, go] = useLocation();
  const gAt = useRef(0);
  // Shares the Roadmap's cache entry; only fetched once the palette is first opened.
  const { data } = useQuery({ queryKey: ["roadmap"], queryFn: async () => loadRoadmap(await getDb()), enabled: open });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (!open && !typing(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key === "g") gAt.current = Date.now();
        else if (Date.now() - gAt.current < 800 && GO[e.key]) {
          gAt.current = 0;
          go(GO[e.key]);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, go, setOpen]);

  const pick = (to: string) => {
    setOpen(false);
    go(to);
  };
  const item = "flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 data-[selected=true]:bg-raised";

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette" overlayClassName="fixed inset-0 bg-bg/70" contentClassName="fixed left-1/2 top-[15vh] w-[560px] max-w-[92vw] -translate-x-1/2 overflow-hidden rounded-md border border-line bg-surface shadow-lg">
      <Command.Input placeholder="Jump to a page or session…" className="w-full border-b border-line bg-transparent px-4 py-3 outline-none" />
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-2 py-6 text-center text-muted">No matches.</Command.Empty>
        <Command.Group heading="Pages" className="text-[12px] text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
          {NAV.map((n) => (
            <Command.Item key={n.path} value={`page ${n.label}`} onSelect={() => pick(n.path)} className={`${item} text-text`}>
              <n.icon size={14} aria-hidden className="text-muted" />
              <span className="flex-1 text-[13px]">{n.label}</span>
              {keyOf(n.path) && <kbd className="num text-[12px] text-muted">g {keyOf(n.path)}</kbd>}
            </Command.Item>
          ))}
        </Command.Group>
        {data && (
          <Command.Group heading="Sessions" className="text-[12px] text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1">
            {data.sessions.map((s) => (
              <Command.Item key={s.id} value={`${s.title} ${s.module_code} L${s.level_num} #${s.id}`} onSelect={() => pick(`/roadmap?s=${s.id}`)} className={`${item} text-text`}>
                <span className="num w-8 text-[12px] text-muted">L{s.level_num}</span>
                <span className={`min-w-0 flex-1 truncate text-[13px] ${s.status === "done" ? "text-muted line-through" : ""}`}>{s.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
