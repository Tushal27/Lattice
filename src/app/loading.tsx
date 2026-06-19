export default function Loading() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="h-40 rounded-3xl bg-zinc-900/60" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-zinc-900/50" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-900/40" />
        ))}
      </div>
    </div>
  );
}
