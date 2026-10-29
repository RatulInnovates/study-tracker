import { useState } from "react";
import { Search } from "lucide-react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Link, Route, Switch, useRoute } from "wouter";
import { Toaster } from "sonner";
import { getDb } from "../db/client";
import { migrate } from "../db/migrate";
import { seedIfNeeded } from "../db/seed";
import { bootSettings } from "../features/settings/theme";
import { CommandPalette } from "./CommandPalette";
import { NAV } from "./nav";

const queryClient = new QueryClient();

async function boot() {
  if (!("__TAURI_INTERNALS__" in window))
    throw new Error("Open the desktop window that `npm run tauri dev` launches. A browser tab has no database.");
  const db = await getDb();
  await migrate(db);
  await seedIfNeeded(db);
  await bootSettings(db);
  return true; // react-query rejects undefined results
}

function SidebarLink({ path, label, icon: Icon }: { path: string; label: string; icon: (typeof NAV)[number]["icon"] }) {
  const [active] = useRoute(path === "/" ? "/" : `${path}/:rest*`);
  return (
    <Link
      href={path}
      aria-current={active ? "page" : undefined}
      className={`press flex items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-[13px] ${
        active ? "bg-raised text-text" : "text-muted hover:text-text"
      }`}
    >
      <Icon size={16} aria-hidden />
      <span className="max-[900px]:hidden">{label}</span>
    </Link>
  );
}

function Shell() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  return (
    <div className="flex h-full">
      <nav aria-label="Primary" className="flex w-52 shrink-0 flex-col gap-0.5 border-r border-line bg-surface p-2 max-[900px]:w-12">
        <div className="px-2.5 pb-3 pt-2 text-[13px] font-semibold tracking-tight max-[900px]:hidden">Study Tracker</div>
        {NAV.map((n) => (
          <SidebarLink key={n.path} path={n.path} label={n.label} icon={n.icon} />
        ))}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command palette"
          className="press mt-auto flex items-center gap-2.5 rounded-sm border border-line px-2.5 py-1.5 text-[13px] text-muted hover:text-text"
        >
          <Search size={16} aria-hidden />
          <span className="max-[900px]:hidden">Jump to…</span>
          <kbd className="num ml-auto text-[12px] max-[900px]:hidden">Ctrl K</kbd>
        </button>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Switch>
          {NAV.map((n) => (
            <Route key={n.path} path={n.path} component={n.page} />
          ))}
          <Route>
            <p className="p-8 text-muted">Page not found.</p>
          </Route>
        </Switch>
      </main>
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} />
    </div>
  );
}

function BootGate() {
  const { error, isPending } = useQuery({ queryKey: ["boot"], queryFn: boot, staleTime: Infinity, retry: false });
  if (error)
    return (
      <div className="p-8" role="alert">
        <h1 className="text-lg font-semibold text-danger">Database failed to start</h1>
        <pre className="num mt-2 whitespace-pre-wrap text-muted">{String(error)}</pre>
      </div>
    );
  if (isPending) return <div className="p-8 text-muted">Preparing your roadmap…</div>;
  return <Shell />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BootGate />
      <Toaster theme="system" position="bottom-right" />
    </QueryClientProvider>
  );
}
