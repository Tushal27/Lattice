// Gemini integration for Lattice's thinking-partner features.
//
// We call the Generative Language REST API directly (no SDK) so the only thing
// required to enable AI is a GEMINI_API_KEY env var. Every helper degrades
// gracefully to a local heuristic when the key is absent or the call fails, so
// the app is fully usable offline — the AI just makes it sharper.

const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function aiEnabled(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

interface GeminiOptions {
  system?: string;
  temperature?: number;
}

/**
 * Returns generated text, or null if AI is unavailable / errored.
 * Callers should always provide their own fallback for the null case.
 */
export async function geminiGenerate(prompt: string, opts: GeminiOptions = {}): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(opts.system
          ? { systemInstruction: { parts: [{ text: opts.system }] } }
          : {}),
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: opts.temperature ?? 0.7 },
      }),
      // The thinking-partner calls can be a little slow; give them room.
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
  } catch (err) {
    console.error("Gemini request errored", err);
    return null;
  }
}

export const THINKING_PARTNER_SYSTEM = [
  "You are the thinking partner inside Lattice, a personal operating system where",
  "someone records decisions, lessons, aha moments, open questions and projects.",
  "Your job is not to answer for them but to help them think better: surface",
  "patterns, connect ideas across areas, challenge assumptions gently, and ask",
  "one or two genuinely useful questions. Be concise, specific, and warm.",
  "Reference their actual entries when relevant. Never invent facts about them.",
].join(" ");
