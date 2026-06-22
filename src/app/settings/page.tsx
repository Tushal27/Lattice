import { ActivityLog } from "@/components/ActivityLog";
import { GoogleConnect } from "@/components/GoogleConnect";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PermissionSettings } from "@/components/PermissionSettings";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out] space-y-8">
      <PageHeader
        icon="⚙️"
        title="Settings"
        subtitle="Connect Lattice to your world, decide how much it acts on its own, and see everything it's done."
      />

      <section className="space-y-3">
        <h2 className="section-label px-1">Integrations</h2>
        <GoogleConnect />
      </section>

      <section className="space-y-3">
        <h2 className="section-label px-1">Trust &amp; autonomy</h2>
        <p className="px-1 text-sm text-zinc-500">
          How much the assistant may do on its own. <strong className="text-zinc-300">Ask</strong> proposes and waits;{" "}
          <strong className="text-zinc-300">Auto</strong> acts, then tells you.
        </p>
        <PermissionSettings />
      </section>

      <section className="space-y-3">
        <h2 className="section-label px-1">Notifications</h2>
        <NotificationToggle />
      </section>

      <section className="space-y-3">
        <h2 className="section-label px-1">Activity — what the assistant has done</h2>
        <ActivityLog />
      </section>
    </div>
  );
}
