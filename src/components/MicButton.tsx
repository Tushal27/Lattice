"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Voice → text via the browser's built-in Web Speech API. No external service:
// it's on-device, free, and works on Android Chrome and iOS Safari. The button
// renders nothing on browsers without support, so callers can drop it in safely.

interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  results: ArrayLike<RecognitionResultLike>;
  resultIndex: number;
}
interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => RecognitionLike;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function MicButton({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<RecognitionLike | null>(null);
  const baseRef = useRef("");
  const finalRef = useRef("");

  useEffect(() => {
    // Capability detection must run on the client (window is undefined on the
    // server), so a one-time setState in this effect is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(getCtor() !== null);
  }, []);

  // Let a parent (e.g. on form submit) stop dictation via a global event.
  useEffect(() => {
    const onStop = () => {
      recRef.current?.stop();
      setListening(false);
    };
    window.addEventListener("lattice:stt-stop", onStop);
    return () => window.removeEventListener("lattice:stt-stop", onStop);
  }, []);

  function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = value.trim() ? value.trim() + " " : "";
    finalRef.current = "";
    rec.onresult = (e) => {
      // Accumulate only finalized results (once, into a ref); show the current
      // interim chunk transiently. Iterating from resultIndex avoids re-adding
      // earlier results, which is what caused "III wantI want to…" duplication.
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      onChange((baseRef.current + finalRef.current + interim).replace(/\s+/g, " ").trimStart());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? "Stop dictation" : "Dictate with your voice"}
      aria-pressed={listening}
      className={cn(
        "press relative grid place-items-center rounded-full transition-colors",
        listening ? "bg-rose-500/90 text-white" : "text-zinc-400 hover:bg-white/10 hover:text-zinc-200",
        className,
      )}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />}
      <svg
        viewBox="0 0 24 24"
        className="relative h-[18px] w-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
