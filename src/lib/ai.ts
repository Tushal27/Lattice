// Provider-agnostic AI layer for Lattice's thinking-partner features.
//
// Set ANY one of these keys and it just works (auto-selected in this order):
//   GROQ_API_KEY        — Groq (recommended: fast, generous free tier)
//   OPENROUTER_API_KEY  — OpenRouter (many free model variants)
//   GEMINI_API_KEY      — Google Gemini (free tier, but rate-limits easily)
//
// Optionally force one with AI_PROVIDER=groq|openrouter|gemini.
// Every caller degrades gracefully to a local heuristic when no provider is
// configured or a call fails, so the app stays fully usable without AI.

type Provider = "groq" | "openrouter" | "gemini";

interface GenerateOptions {
  system?: string;
  temperature?: number;
}

const MODELS = {
  groq: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
  openrouter: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
  gemini: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
};

function activeProvider(): Provider | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "groq" && process.env.GROQ_API_KEY) return "groq";
  if (forced === "openrouter" && process.env.OPENROUTER_API_KEY) return "openrouter";
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.GROQ_API_KEY) return "groq";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function aiEnabled(): boolean {
  return activeProvider() !== null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST with a single automatic retry on 429 (rate limit) / 503. */
async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 429 || res.status === 503) {
    await sleep(1400);
    res = await fetch(url, init);
  }
  return res;
}

/**
 * Returns generated text, or null if AI is unavailable / errored.
 * Callers should always provide their own fallback for the null case.
 */
export async function generate(prompt: string, opts: GenerateOptions = {}): Promise<string | null> {
  const provider = activeProvider();
  if (!provider) return null;
  try {
    return provider === "gemini" ? await callGemini(prompt, opts) : await callOpenAICompatible(provider, prompt, opts);
  } catch (err) {
    console.error(`AI request errored (${provider})`, err);
    return null;
  }
}

// Groq and OpenRouter both speak the OpenAI chat-completions format.
async function callOpenAICompatible(
  provider: "groq" | "openrouter",
  prompt: string,
  opts: GenerateOptions,
): Promise<string | null> {
  const url =
    provider === "groq"
      ? "https://api.groq.com/openai/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const key = provider === "groq" ? process.env.GROQ_API_KEY : process.env.OPENROUTER_API_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://lattice.app";
    headers["X-Title"] = "Lattice";
  }

  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: prompt },
  ];

  const res = await postWithRetry(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: MODELS[provider], messages, temperature: opts.temperature ?? 0.7 }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.error(`${provider} request failed`, res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function callGemini(prompt: string, opts: GenerateOptions): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${key}`;
  const res = await postWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: opts.temperature ?? 0.7 },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.error("Gemini request failed", res.status, await res.text().catch(() => ""));
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
].join(" ");
