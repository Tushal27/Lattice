// Provider-agnostic AI engine with an automatic fallback chain.
//
// Configure ANY number of providers/keys via env. The engine builds an ordered
// list of candidates and tries each until one answers — so a rate-limited (429)
// or down provider transparently falls through to the next. You can also supply
// MULTIPLE comma-separated keys for one provider to rotate around per-key limits:
//
//   GROQ_API_KEY="key_a,key_b"
//   OPENROUTER_API_KEY="..."
//   GEMINI_API_KEY="..."
//
// Order is Groq → OpenRouter → Cerebras → Mistral → Together → Gemini by default.
// Override with AI_PROVIDER_ORDER="mistral,groq,gemini" or pin one with
// AI_PROVIDER="groq". No keys → callers fall back to local heuristics.

type Kind = "openai" | "gemini";

interface ProviderSpec {
  name: string;
  kind: Kind;
  keyEnv: string;
  modelEnv: string;
  defaultModel: string;
  url: string; // chat-completions endpoint (openai kind)
  headers?: () => Record<string, string>;
}

// Most providers speak the OpenAI chat-completions format, so they share a path.
const REGISTRY: ProviderSpec[] = [
  // Your own / self-hosted OpenAI-compatible endpoint. Set AI_BASE_URL +
  // AI_API_KEY (+ optional AI_MODEL) and it becomes the primary engine.
  // Defaults to "auto" for rosters/routers that pick the model themselves.
  {
    name: "custom",
    kind: "openai",
    keyEnv: "AI_API_KEY",
    modelEnv: "AI_MODEL",
    defaultModel: "auto",
    url: "", // resolved at runtime from AI_BASE_URL
  },
  {
    name: "groq",
    kind: "openai",
    keyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
    url: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    name: "openrouter",
    kind: "openai",
    keyEnv: "OPENROUTER_API_KEY",
    modelEnv: "OPENROUTER_MODEL",
    defaultModel: "meta-llama/llama-3.3-70b-instruct:free",
    url: "https://openrouter.ai/api/v1/chat/completions",
    headers: () => ({ "HTTP-Referer": "https://lattice.app", "X-Title": "Lattice" }),
  },
  {
    name: "cerebras",
    kind: "openai",
    keyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    defaultModel: "llama-3.3-70b",
    url: "https://api.cerebras.ai/v1/chat/completions",
  },
  {
    name: "mistral",
    kind: "openai",
    keyEnv: "MISTRAL_API_KEY",
    modelEnv: "MISTRAL_MODEL",
    defaultModel: "mistral-small-latest",
    url: "https://api.mistral.ai/v1/chat/completions",
  },
  {
    name: "together",
    kind: "openai",
    keyEnv: "TOGETHER_API_KEY",
    modelEnv: "TOGETHER_MODEL",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    url: "https://api.together.xyz/v1/chat/completions",
  },
  {
    name: "gemini",
    kind: "gemini",
    keyEnv: "GEMINI_API_KEY",
    modelEnv: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
    url: "",
  },
];

interface Candidate {
  spec: ProviderSpec;
  key: string;
  model: string;
  url: string;
}

function resolveOrder(): string[] {
  const forced = process.env.AI_PROVIDER?.toLowerCase().trim();
  if (forced) return [forced];
  const custom = process.env.AI_PROVIDER_ORDER?.toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (custom && custom.length) return custom;
  return REGISTRY.map((s) => s.name);
}

function resolveUrl(spec: ProviderSpec): string {
  if (spec.name === "custom") {
    const base = process.env.AI_BASE_URL?.trim().replace(/\/+$/, "");
    return base ? `${base}/chat/completions` : "";
  }
  return spec.url;
}

function candidates(): Candidate[] {
  const out: Candidate[] = [];
  for (const name of resolveOrder()) {
    const spec = REGISTRY.find((s) => s.name === name);
    if (!spec) continue;
    const raw = process.env[spec.keyEnv];
    if (!raw) continue;
    const url = resolveUrl(spec);
    if (spec.kind === "openai" && !url) continue; // e.g. custom without AI_BASE_URL
    const model = process.env[spec.modelEnv]?.trim() || spec.defaultModel;
    for (const key of raw.split(",").map((k) => k.trim()).filter(Boolean)) {
      out.push({ spec, key, model, url });
    }
  }
  return out;
}

export function aiEnabled(): boolean {
  return candidates().length > 0;
}

/** Names of the providers that have at least one key configured, in try order. */
export function configuredProviders(): string[] {
  return [...new Set(candidates().map((c) => c.spec.name))];
}

interface GenerateOptions {
  system?: string;
  temperature?: number;
  /** Base64 data URLs (e.g. data:image/jpeg;base64,…) for vision-capable models. */
  images?: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs the fallback chain and returns the first successful result together with
 * the provider that produced it (handy for showing which key is live). Returns
 * null only when every configured candidate fails.
 */
export async function generateDetailed(
  prompt: string,
  opts: GenerateOptions = {},
): Promise<{ text: string; provider: string } | null> {
  const cands = candidates();
  if (cands.length === 0) return null;

  // Two passes: the first walks every provider/key; the second gives transient
  // failures (e.g. a lone rate-limited key) one more chance after a short pause.
  for (let pass = 0; pass < 2; pass++) {
    for (const c of cands) {
      try {
        const text =
          c.spec.kind === "gemini"
            ? await callGemini(c.key, c.model, prompt, opts)
            : await callOpenAI(c.spec, c.url, c.key, c.model, prompt, opts);
        if (text) return { text, provider: c.spec.name };
      } catch (err) {
        console.error(`AI candidate failed (${c.spec.name})`, err);
      }
    }
    if (pass === 0) await sleep(900);
  }
  return null;
}

/** Convenience wrapper that returns just the text. */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string | null> {
  return (await generateDetailed(prompt, opts))?.text ?? null;
}

async function callOpenAI(
  spec: ProviderSpec,
  url: string,
  key: string,
  model: string,
  prompt: string,
  opts: GenerateOptions,
): Promise<string | null> {
  const userContent =
    opts.images && opts.images.length > 0
      ? [
          { type: "text", text: prompt },
          ...opts.images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : prompt;
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: userContent },
  ];
  // Vision payloads can be larger/slower than text — give them more time.
  const timeout = opts.images && opts.images.length ? 60_000 : 30_000;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(spec.headers?.() ?? {}),
    },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7 }),
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) {
    console.warn(`${spec.name} ${res.status}`, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(
  key: string,
  model: string,
  prompt: string,
  opts: GenerateOptions,
): Promise<string | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  const parts: Array<Record<string, unknown>> = [{ text: prompt }];
  for (const u of opts.images ?? []) {
    const comma = u.indexOf(",");
    const mime = u.slice(5, u.indexOf(";")) || "image/jpeg";
    parts.push({ inline_data: { mime_type: mime, data: u.slice(comma + 1) } });
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: opts.temperature ?? 0.7 },
    }),
    signal: AbortSignal.timeout(opts.images && opts.images.length ? 60_000 : 30_000),
  });
  if (!res.ok) {
    console.warn(`gemini ${res.status}`, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  return text?.trim() || null;
}

export const THINKING_PARTNER_SYSTEM = [
  "You are the thinking partner inside Lattice, a personal operating system where",
  "someone records decisions, lessons, aha moments, open questions and projects.",
  "Your job is not to answer for them but to help them think better: surface",
  "patterns, connect ideas across areas, challenge assumptions gently, and ask",
  "one or two genuinely useful questions. Be concise, specific, and warm.",
  "Reference their actual entries when relevant. Never invent facts about them.",
  "The user often types fast with typos or dictates by voice, so expect",
  "misspellings, swapped homophones, missing punctuation, and mangled words.",
  "Always read for what they MEANT, interpret messy or garbled input charitably,",
  "and never nitpick spelling or get derailed by a transcription error — if a word",
  "looks off, infer the obvious intended one and carry on.",
].join(" ");
