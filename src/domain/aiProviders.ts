export type ProviderId = "claude-cli" | "anthropic" | "openai" | "gemini" | "openrouter" | "groq" | "ollama" | "custom";

export interface Provider {
  id: ProviderId;
  label: string;
  baseUrl: string; // "" = fixed by the app (CLI, Anthropic) or entered by the user (custom)
  modelHint: string;
  needsKey: boolean;
  tier: "frontier" | "local"; // drives the feature warnings below
  note: string;
}

export const PROVIDERS: Provider[] = [
  { id: "claude-cli", label: "Claude Code (your Claude Pro/Max login)", baseUrl: "", modelHint: "", needsKey: false, tier: "frontier", note: "No API key and no extra bill. This is the path the app was built and tested with." },
  { id: "anthropic", label: "Anthropic API key", baseUrl: "", modelHint: "claude-sonnet-5-5", needsKey: true, tier: "frontier", note: "Billed per token on your Anthropic API account, separately from a Claude Pro subscription." },
  { id: "openai", label: "OpenAI API key", baseUrl: "https://api.openai.com/v1", modelHint: "a model id from your OpenAI account", needsKey: true, tier: "frontier", note: "Billed per token." },
  { id: "gemini", label: "Google Gemini API key", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelHint: "a Gemini model id", needsKey: true, tier: "frontier", note: "Uses Google's OpenAI-compatible endpoint. Has a free tier with rate limits." },
  { id: "openrouter", label: "OpenRouter API key", baseUrl: "https://openrouter.ai/api/v1", modelHint: "provider/model, e.g. from openrouter.ai/models", needsKey: true, tier: "frontier", note: "One key for many models. Quality depends on the model you pick." },
  { id: "groq", label: "Groq API key", baseUrl: "https://api.groq.com/openai/v1", modelHint: "a model id from console.groq.com", needsKey: true, tier: "frontier", note: "Fast, with free-tier limits. Model context windows are often smaller." },
  { id: "ollama", label: "Ollama (local model, no key)", baseUrl: "http://localhost:11434/v1", modelHint: "e.g. llama3.1", needsKey: false, tier: "local", note: "Runs on your machine; nothing leaves it. Small local models are the least reliable here." },
  { id: "custom", label: "Other OpenAI-compatible server", baseUrl: "", modelHint: "model id", needsKey: false, tier: "frontier", note: "Any server that supports /chat/completions (LM Studio, vLLM, your own gateway)." },
];

export const providerById = (id: string) => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

export type Support = "ok" | "caution";
export interface FeatureNote {
  feature: string;
  needs: string;
  /** Warning shown for small or local models; frontier models are expected to be fine. */
  localRisk: string;
}

// Every feature sends one text prompt and reads one JSON reply, so these are the real differences between models.
export const FEATURES: FeatureNote[] = [
  { feature: "Code review (Review page)", needs: "a long context window (diffs and test output up to ~60,000 characters) and strictly valid nested JSON", localRisk: "May not work: the prompt can exceed a small model's context, and nested JSON often fails validation." },
  { feature: "Quiz generation (Quiz & Cards)", needs: "5 well-formed questions as valid JSON", localRisk: "May fail or give weak questions; the app retries once, then shows an error." },
  { feature: "Quiz short-answer grading", needs: "reliable judgement of paraphrased answers", localRisk: "Grading can be wrong, which also affects the cards and readiness scores built from it." },
  { feature: "Interview practice", needs: "questions plus honest 0-100 scoring and feedback", localRisk: "Scores can be inflated or inconsistent." },
  { feature: "Resume bullets (Portfolio)", needs: "short text that sticks to the facts you logged", localRisk: "Usually fine; check it did not invent numbers." },
];

/** Plain-language heads-up for the selected provider. */
export function compatibility(p: Provider) {
  const rows = FEATURES.map((f) => ({ feature: f.feature, needs: f.needs, support: (p.tier === "local" ? "caution" : "ok") as Support, text: p.tier === "local" ? f.localRisk : "Expected to work." }));
  const caveats = [
    ...(p.id === "claude-cli" ? [] : ["Only the Claude Code option has been tested by the app's author. Other providers are expected to work but are untested."]),
    ...(p.id === "claude-cli" ? [] : ["Code review sends your repo diff (minus .env, key and ignored files) and test output to this provider. Do not use it on code you cannot share with them."]),
    ...(p.id === "custom" || p.id === "openrouter" || p.id === "groq" ? ["Results depend on the model you enter. Small models behave like the local-model warnings above."] : []),
  ];
  return { rows, caveats };
}
