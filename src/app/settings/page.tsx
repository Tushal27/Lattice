import { GmailConnect } from "@/components/GmailConnect";
import { NotificationToggle } from "@/components/NotificationToggle";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl animate-[fadeUp_0.4s_ease-out] space-y-6">
      <PageHeader
        icon="⚙️"
        title="Settings"
        subtitle="Connect Lattice to the rest of your world and tune how it reaches you."
      />

      <section className="space-y-3">
        <h2 className="section-label px-1">Integrations</h2>
        <GmailConnect />
      </section>

      <section className="space-y-3">
        <h2 className="section-label px-1">Notifications</h2>
        <NotificationToggle />
      </section>
    </div>
  );
}
