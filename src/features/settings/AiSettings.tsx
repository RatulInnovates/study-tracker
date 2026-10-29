import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { compatibility, PROVIDERS, providerById } from "../../domain/aiProviders";
import { ClaudeStatus } from "./ClaudeStatus";

interface Cfg {
  provider: string;
  base_url: string;
  model: string;
  has_key: boolean;
}
const field = "w-full rounded-sm border border-line bg-surface px-2 py-1 text-text";
const btn = "press rounded-sm border border-line bg-raised px-3 py-1.5 text-[13px] disabled:opacity-50";
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Choose which AI answers the app's AI features, with a heads-up about what may not work on it. */
export function AiSettings() {
  const qc = useQueryClient();
  const { data: saved } = useQuery({ queryKey: ["ai-config"], queryFn: () => invoke<Cfg>("ai_get_config") });
  const [provider, setProvider] = useState("claude-cli");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!saved) return;
    setProvider(saved.provider);
    setBaseUrl(saved.base_url);
    setModel(saved.model);
  }, [saved]);

  const p = providerById(provider);
  const fixedUrl = !!p.baseUrl;
  const { rows, caveats } = compatibility(p);
  const isApi = provider !== "claude-cli";
  const dirty = !!saved && (provider !== saved.provider || baseUrl !== saved.base_url || model !== saved.model || key !== "");

  function choose(id: string) {
    const next = providerById(id);
    setProvider(id);
    setBaseUrl(next.baseUrl);
    setModel(id === saved?.provider ? saved.model : "");
    setKey("");
    setTest(null);
  }

  async function save(clearKey = false) {
    setBusy("save");
    try {
      await invoke("ai_set_config", { provider, baseUrl, model, apiKey: key || null, clearKey });
      setKey("");
      await qc.invalidateQueries({ queryKey: ["ai-config"] });
      toast.success(clearKey ? "API key removed" : "AI settings saved");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  }

  async function runTest() {
    setBusy("test");
    setTest(null);
    try {
      const text = await invoke<string>("ai_ask", { prompt: "Reply with the single word OK." });
      setTest({ ok: true, text: `Working. Reply: ${text.trim().slice(0, 80)}` });
    } catch (e) {
      setTest({ ok: false, text: errMsg(e) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-4">
        Provider
        <select className={`${field} max-w-sm`} value={provider} onChange={(e) => choose(e.target.value)}>
          {PROVIDERS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </label>
      <p className="text-muted">{p.note}</p>

      {isApi && (
        <div className="space-y-3">
          {provider !== "anthropic" && (
            <label className="flex items-center justify-between gap-4">
              Base URL
              <input className={`${field} max-w-sm`} value={baseUrl} readOnly={fixedUrl} placeholder="https://host/v1" onChange={(e) => setBaseUrl(e.target.value)} />
            </label>
          )}
          <label className="flex items-center justify-between gap-4">
            Model
            <input className={`${field} max-w-sm`} value={model} placeholder={p.modelHint} onChange={(e) => setModel(e.target.value)} />
          </label>
          <label className="flex items-center justify-between gap-4">
            API key
            <input
              type="password" autoComplete="off" className={`${field} max-w-sm`} value={key}
              placeholder={saved?.has_key && provider === saved.provider ? "saved (type to replace)" : p.needsKey ? "paste your key" : "optional"}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <p className="text-muted">
            The key is kept in a separate file in the app's config folder, never in the database, so backups and exports do not contain it. It is sent only to the URL above. Changing the provider or URL clears the saved key.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={busy !== null || !dirty} onClick={() => save()}>Save</button>
        <button className={btn} disabled={busy !== null || dirty} onClick={runTest} title={dirty ? "Save first" : undefined}>
          {busy === "test" ? <Loader2 size={14} className="inline motion-safe:animate-spin" aria-hidden /> : null} Test connection
        </button>
        {isApi && saved?.has_key && provider === saved.provider && <button className={btn} disabled={busy !== null} onClick={() => save(true)}>Remove saved key</button>}
      </div>
      {test && <p role="status" className={`num whitespace-pre-wrap break-words ${test.ok ? "" : "text-danger"}`}>{test.text}</p>}

      {provider === "claude-cli" && <ClaudeStatus />}

      <div className="rounded-md border border-line bg-surface p-3">
        <p className="mb-2 font-medium">What to expect with this provider</p>
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.feature} className="flex gap-2">
              <span aria-label={r.support === "ok" ? "Expected to work" : "Caution"} className={`mt-0.5 shrink-0 ${r.support === "ok" ? "text-accent" : "text-danger"}`}>{r.support === "ok" ? "✓" : "!"}</span>
              <span className="min-w-0">
                <span className="font-medium">{r.feature}</span>
                <span className="block text-muted">{r.text} Needs {r.needs}.</span>
              </span>
            </li>
          ))}
        </ul>
        {caveats.map((c) => <p key={c} className="mt-2 text-muted">{c}</p>)}
      </div>
    </div>
  );
}
