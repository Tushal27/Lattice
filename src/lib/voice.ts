// Browser voice I/O — speech recognition in, speech synthesis out. Both are
// on-device, free, and degrade gracefully (callers check support first).

export interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
export interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
  resultIndex: number;
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e?: unknown) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function voiceInSupported(): boolean {
  return getRecognitionCtor() !== null;
}

export function voiceOutSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Strip markdown so the spoken version sounds natural (no asterisks, backticks,
// header hashes, or raw URLs read aloud).
export function speakableText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " code block. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, " link ")
    .replace(/[#*_>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function speak(text: string, onEnd?: () => void): void {
  if (!voiceOutSupported()) {
    onEnd?.();
    return;
  }
  const clean = speakableText(text);
  if (!clean) {
    onEnd?.();
    return;
  }
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = navigator.language || "en-US";
  u.rate = 1.02;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function stopSpeaking(): void {
  if (voiceOutSupported()) window.speechSynthesis.cancel();
}
