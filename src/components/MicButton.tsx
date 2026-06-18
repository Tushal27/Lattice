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
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      onChange(baseRef.current + transcript);
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
        listening ? "bg-rose-500/90 text-white" : "border border-white/10 bg-white/5 text-zinc-300 hover:text-white",
        className,
      )}
    >
      {listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />}
      <span className="relative text-base leading-none">🎤</span>
    </button>
  );
}
