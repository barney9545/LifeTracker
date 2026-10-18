/** Today's-progress card: % bar over a row of counts. Shown in a panel's ⓘ popup. */
export default function ProgressCard({
  title, pct, stats,
}: {
  title: string;
  pct: number;
  stats: { label: string; value: number; color: string }[];
}) {
  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--c-text)]">{title}</span>
        <span className="text-[13px] font-semibold text-[var(--c-accent)]">{pct}%</span>
      </div>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
        <div className="h-full rounded-full bg-[var(--c-accent)] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between">
        {stats.map((s) => (
          <div key={s.label} className="flex flex-col items-center">
            <span className="text-[20px] font-semibold leading-none" style={{ color: s.color }}>{s.value}</span>
            <span className="mt-1 text-[11px] text-[var(--c-muted)]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
