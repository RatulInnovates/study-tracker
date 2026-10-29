import { invoke } from "@tauri-apps/api/core";

/** One `claude -p --output-format json` call (~10s). Returns the model's text from the `result` field. */
export async function askClaude(prompt: string): Promise<string> {
  const raw = await invoke<string>("claude_ask", { prompt });
  let out: { result?: unknown; is_error?: boolean };
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`claude CLI returned non-JSON output: ${raw.slice(0, 200)}`);
  }
  if (out.is_error || typeof out.result !== "string") throw new Error(`claude CLI error: ${String(out.result ?? raw).slice(0, 300)}`);
  return out.result;
}

/** askClaude + parse, retried once with the validation error quoted back to the model. */
export async function askParsed<T>(prompt: string, parse: (text: string) => T): Promise<T> {
  try {
    return parse(await askClaude(prompt));
  } catch (first) {
    const why = first instanceof Error ? first.message : String(first);
    return parse(await askClaude(`${prompt}\n\nYour previous reply was rejected: ${why}. Reply with ONLY the JSON object.`));
  }
}
