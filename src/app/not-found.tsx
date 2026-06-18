import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div className="animate-[fadeUp_0.4s_ease-out]">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-sky-500 text-2xl">
          ⌘
        </div>
        <h1 className="text-2xl font-semibold text-zinc-100">Lost the thread</h1>
        <p className="mt-2 text-zinc-400">This entry doesn&apos;t exist, or it was deleted.</p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
