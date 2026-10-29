import { invoke } from "@tauri-apps/api/core";

/** One model call through whichever provider Settings > AI selects (Claude CLI by default, ~10s). Returns the reply text. */
export const askClaude = (prompt: string) => invoke<string>("ai_ask", { prompt });

/** askClaude + parse, retried once with the validation error quoted back to the model. */
export async function askParsed<T>(prompt: string, parse: (text: string) => T): Promise<T> {
  try {
    return parse(await askClaude(prompt));
  } catch (first) {
    const why = first instanceof Error ? first.message : String(first);
    return parse(await askClaude(`${prompt}\n\nYour previous reply was rejected: ${why}. Reply with ONLY the JSON object.`));
  }
}
