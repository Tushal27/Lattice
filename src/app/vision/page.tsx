import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Vision — Lattice" };

const ERAS = [
  {
    tag: "Past",
    title: "Knowledge management",
    color: "border-zinc-700 text-zinc-400",
    body: "Notes apps store what you wrote. They remember text. They don't understand it, connect it, or do anything with it. The work of thinking still falls entirely on you.",
  },
  {
    tag: "Present",
    title: "A personal AI operating system",
    color: "border-violet-500/40 text-violet-200",
    body: "Lattice captures how you decide and learn, connects it by meaning, recalls the right thing at the right moment, and reasons over it. Your judgment compounds instead of evaporating.",
  },
  {
    tag: "Future",
    title: "A personal Jarvis",
    color: "border-sky-500/40 text-sky-200",
    body: "It already sees your world (calendar, mail, code), reaches you (briefs), and acts within permissions you set (scheduling, capture). The trajectory is more autonomy, earned one verified action at a time.",
  },
];

export default function VisionPage() {
  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader icon="🧭" title="Vision" subtitle="Where this is going — capability evolution, not hype." />

      <p className="text-[15px] leading-relaxed text-zinc-300">
        Most tools help you <em>store</em> information. Lattice exists to help your <strong className="text-zinc-100">judgment
        compound</strong> — so the person you are in five years is measurably wiser than today, because nothing you learned
        was lost and nothing you decided went un-reviewed.
      </p>

      <div className="space-y-4">
        {ERAS.map((e) => (
          <div key={e.tag} className={`rounded-2xl border bg-white/[0.02] p-5 ${e.color.split(" ")[0]}`}>
            <div className={`text-[11px] font-semibold uppercase tracking-wider ${e.color.split(" ").slice(1).join(" ")}`}>
              {e.tag}
            </div>
            <h2 className="mt-1 text-lg font-semibold text-zinc-100">{e.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{e.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-zinc-100">The principle that won&apos;t change</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Autonomy is only valuable if it&apos;s trusted, and trust is earned, not assumed. Every capability has a dial —
          off, ask, or act — and every action it takes is recorded. The system is designed for AI agents acting{" "}
          <em>safely</em>, which is the hard part everyone skips.
        </p>
        <Link href="/architecture" className="mt-3 inline-block text-sm font-medium text-violet-300 hover:underline">
          See how it&apos;s built →
        </Link>
      </div>
    </div>
  );
}
