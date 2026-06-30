export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center justify-between pb-5">
        <div className="space-y-2">
          <div className="h-3 w-24 rounded bg-[var(--c-surface-2)]" />
          <div className="h-5 w-40 rounded bg-[var(--c-surface-2)]" />
        </div>
        <div className="h-10 w-10 rounded-full bg-[var(--c-surface-2)]" />
      </div>
      <div className="mb-4 h-24 rounded-2xl bg-[var(--c-surface-2)]" />
      <div className="mb-6 h-28 rounded-2xl bg-[var(--c-surface)]" />
      <div className="flex flex-col gap-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-2xl bg-[var(--c-surface)]" />
        ))}
      </div>
    </div>
  );
}
