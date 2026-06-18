export const metadata = { title: "Offline — Lattice" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="animate-[fadeUp_0.4s_ease-out]">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 text-2xl">
          ⌘
        </div>
        <h1 className="text-2xl font-semibold text-zinc-100">You&apos;re offline</h1>
        <p className="mt-2 max-w-sm text-zinc-400">
          Pages you&apos;ve already opened are still here. Reconnect to capture new thoughts and sync the rest.
        </p>
      </div>
    </div>
  );
}
