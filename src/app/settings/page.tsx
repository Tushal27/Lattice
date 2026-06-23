import { ActivityLog } from "@/components/ActivityLog";
import { AutonomyConfig } from "@/components/AutonomyConfig";
import { AutonomyNow } from "@/components/AutonomyNow";
import { BookmarkletCard } from "@/components/BookmarkletCard";
import { DemoControl } from "@/components/DemoControl";
import { GitHubConnect } from "@/components/GitHubConnect";
import { GoogleConnect } from "@/components/GoogleConnect";
import { IngestPanel } from "@/components/IngestPanel";
import { MemoryCard } from "@/components/MemoryCard";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PermissionSettings } from "@/components/PermissionSettings";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const JUMPS = [
  { id: "demo", label: "🎬 Demo" },
  { id: "integrations", label: "🔗 Integrations" },
  { id: "ingest", label: "📥 Ingest" },
  { id: "autonomy", label: "🤖 Autonomy" },
  { id: "memory", label: "🧠 Memory" },
  { id: "notifications", label: "🔔 Alerts" },
  { id: "activity", label: "🧾 Activity" },
];

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader
        icon="⚙️"
        title="Settings"
        subtitle="Connect Lattice to your world, decide how much it acts on its own, and see everything it's done."
      />

      {/* Quick jump — keeps a long page navigable. */}
      <nav className="flex flex-wrap gap-2">
        {JUMPS.map((j) => (
          <a
            key={j.id}
            href={`#${j.id}`}
            className="press rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/10"
          >
            {j.label}
          </a>
        ))}
      </nav>

      <section id="demo" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">🎬 Demo</h2>
        <DemoControl />
      </section>

      <section id="integrations" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">🔗 Integrations</h2>
        <p className="px-1 text-sm text-zinc-500">Let Lattice see your world. Connect once; control access below.</p>
        <GoogleConnect />
        <GitHubConnect />
      </section>

      <section id="ingest" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">📥 Ingest knowledge</h2>
        <p className="px-1 text-sm text-zinc-500">Pull links, files, and pages into your brain.</p>
        <IngestPanel />
        <BookmarkletCard />
      </section>

      <section id="autonomy" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">🤖 Trust &amp; autonomy</h2>
        <p className="px-1 text-sm text-zinc-500">
          How much the assistant may do on its own. <strong className="text-zinc-300">Ask</strong> proposes and waits;{" "}
          <strong className="text-zinc-300">Auto</strong> acts, then tells you.
        </p>
        <PermissionSettings />
        <AutonomyConfig />
        <AutonomyNow />
      </section>

      <section id="memory" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">🧠 Memory</h2>
        <MemoryCard />
      </section>

      <section id="notifications" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">🔔 Notifications</h2>
        <NotificationToggle />
      </section>

      <section id="activity" className="scroll-mt-24 space-y-3">
        <h2 className="section-label px-1">🧾 Activity — what the assistant has done</h2>
        <ActivityLog />
      </section>
    </div>
  );
}
