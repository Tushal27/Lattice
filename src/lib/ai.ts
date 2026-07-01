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

import { prisma } from "@/lib/db";

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

function candidates(rosterOnly = false): Candidate[] {
  const out: Candidate[] = [];
  for (const name of resolveOrder()) {
    // Roster-only mode: use just the user's own endpoint, no fallback providers.
    if (rosterOnly && name !== "custom") continue;
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

/** Is the user's own roster/endpoint (the "custom" provider) configured? */
export function rosterConfigured(): boolean {
  return candidates().some((c) => c.spec.name === "custom");
}

/** Names of the providers that have at least one key configured, in try order. */
export function configuredProviders(): string[] {
  return [...new Set(candidates().map((c) => c.spec.name))];
}

// ---- runtime AI preferences (DB-backed, tunable in Settings) ----------------

export interface AiConfig {
  /** Use only the user's roster endpoint — never fall back to Groq/others. */
  rosterOnly: boolean;
}

const AI_CONFIG_KEY = "ai:config";
const DEFAULT_AI_CONFIG: AiConfig = { rosterOnly: false };

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const row = await prisma.appState.findUnique({ where: { key: AI_CONFIG_KEY } });
    if (!row) return DEFAULT_AI_CONFIG;
    return { ...DEFAULT_AI_CONFIG, ...(JSON.parse(row.value) as Partial<AiConfig>) };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export async function setAiConfig(patch: Partial<AiConfig>): Promise<AiConfig> {
  const next = { ...(await getAiConfig()), ...patch };
  await prisma.appState.upsert({
    where: { key: AI_CONFIG_KEY },
    create: { key: AI_CONFIG_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
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
  const { rosterOnly } = await getAiConfig();
  const cands = candidates(rosterOnly);
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

/**
 * Streaming counterpart to generate(): yields text deltas as the model produces
 * them, walking the same fallback chain. It commits to the first provider that
 * emits any token — if a provider fails before producing output, it tries the
 * next; once tokens have streamed it never restarts (no duplicate text). Yields
 * nothing if every candidate fails, so callers can fall back.
 */
export async function* streamText(prompt: string, opts: GenerateOptions = {}): AsyncGenerator<string, void, unknown> {
  const { rosterOnly } = await getAiConfig();
  for (const c of candidates(rosterOnly)) {
    let any = false;
    try {
      const gen =
        c.spec.kind === "gemini"
          ? streamGemini(c.key, c.model, prompt, opts)
          : streamOpenAI(c.spec, c.url, c.key, c.model, prompt, opts);
      for await (const chunk of gen) {
        if (!chunk) continue;
        any = true;
        yield chunk;
      }
      if (any) return; // committed to this provider
    } catch (err) {
      console.error(`AI stream candidate failed (${c.spec.name})`, err);
      if (any) return; // already streamed partial output — don't restart elsewhere
    }
  }
}

// Parse OpenAI-style SSE ("data: {…}\n\n", terminated by "data: [DONE]").
async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        yield JSON.parse(data);
      } catch {
        /* skip partial/non-JSON keepalive lines */
      }
    }
  }
}

async function* streamOpenAI(
  spec: ProviderSpec,
  url: string,
  key: string,
  model: string,
  prompt: string,
  opts: GenerateOptions,
): AsyncGenerator<string> {
  const userContent =
    opts.images && opts.images.length > 0
      ? [{ type: "text", text: prompt }, ...opts.images.map((u) => ({ type: "image_url", image_url: { url: u } }))]
      : prompt;
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: userContent },
  ];
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...(spec.headers?.() ?? {}) },
    body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, stream: true }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.body) {
    if (!res.ok) console.warn(`${spec.name} stream ${res.status}`, await res.text().catch(() => ""));
    return;
  }
  for await (const json of parseSSE(res.body)) {
    const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined;
    const delta = choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

async function* streamGemini(key: string, model: string, prompt: string, opts: GenerateOptions): AsyncGenerator<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${key}`;
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
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok || !res.body) return;
  for await (const json of parseSSE(res.body)) {
    const cands = json.candidates as Array<{ content?: { parts?: { text?: string }[] } }> | undefined;
    const text = cands?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (text) yield text;
  }
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

// Wonder chat: answer genuinely well AND ground it in the user's entries — the
// best of ChatGPT depth plus their personal context. (Reflections/judgment keep
// the terser THINKING_PARTNER_SYSTEM below.)
export const WONDER_SYSTEM = [
  "You are Wonder, the thinking partner inside Lattice — the user's personal operating system of",
  "decisions, lessons, aha moments, open questions and projects.",
  "Answer like a brilliant, candid friend who happens to know their context: give a genuinely useful,",
  "well-reasoned answer with real depth when the question calls for it — explain your reasoning, weigh",
  "trade-offs, and be concrete. Structure longer answers with short headers or bullets when it helps;",
  "keep simple answers short. You are NOT limited to brief coaching replies — match length to the question.",
  "Their Lattice entries are BACKGROUND memory, not the subject. Talk like a real, sharp friend who happens",
  "to remember their context — answer the actual question first. Pull from their entries only when it genuinely",
  "adds something, and weave it in lightly and naturally; never invent entries or facts. Do NOT turn replies",
  "into a roundup of their notes or a 'your entries say X, so do Y' checklist — most replies need no entry",
  "references at all. After a substantive answer you MAY add one sharp question — optional, not every time.",
  "The user often types with typos or dictates by voice; read for intent. Be warm, direct, and honest —",
  "disagree when they're wrong.",
  "You also know how Lattice itself works (a guide is provided in context). When the user is confused about",
  "the app or a feature, or asks how/where to do something, explain it clearly and accurately from that",
  "guide and name the exact screen and action — you are their in-app help too.",
  "Silently read the user's intent and adapt: BUILDING (code/architecture/debugging) → precise, structured,",
  "concrete; LEARNING (concepts) → explain simply, build intuition; REFLECTING (personal/emotional) →",
  "acknowledge how they feel FIRST, stay calm and human, don't tech-dump or over-optimize; PLANNING",
  "(decisions/strategy) → lay out options and trade-offs and give a clear recommendation; CASUAL → brief and",
  "warm. If they seem stressed or down, slow down and reassure before advising. If they seem confused,",
  "simplify and go step by step. Use the carried memory and their entries for continuity — refer back to",
  "ongoing projects/goals and only suggest a next step when it's genuinely useful. Never give generic",
  "boilerplate, never just restate their message back, prefer clarity over length.",
].join(" ");

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
