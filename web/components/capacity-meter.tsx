import { getChores, getChoreLogs, getChoreMoves, getChoreCapacity } from "@/lib/data";
import { istToday } from "@/lib/core/logic";
import { CHORE_LOG_DAYS, capacityLevel, choresForDay, todayLoad } from "@/lib/chores/logic";
import { capacityColor } from "./ui";

/**
 * Home's day-capacity meter: today's chore points against the daily capacity.
 * The bar's solid part is what's done, the lighter part what's still to go.
 * Chores only — supplements don't count toward capacity.
 */
export default async function CapacityMeter() {
  const [chores, logs, moves, capacity] = await Promise.all([
    getChores(), getChoreLogs(CHORE_LOG_DAYS), getChoreMoves(), getChoreCapacity(),
  ]);
  const { planned, done } = todayLoad(choresForDay(chores, logs, istToday(), moves));
  const color = capacityColor(capacityLevel(planned, capacity)).text;

  // Over capacity, the bar scales to the planned load and a tick marks the limit.
  const scale = Math.max(capacity, planned, 1);
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  const toGo = Math.max(0, planned - done);

  return (
    <section aria-label="Today's capacity"
      className="mb-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-[var(--c-text)]">Today&apos;s capacity</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {planned} <span className="font-medium text-[var(--c-muted)]">/ {capacity}</span>
        </span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
        <div className="absolute inset-y-0 left-0 rounded-full opacity-35" style={{ width: pct(planned), background: color }} />
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width]" style={{ width: pct(done), background: color }} />
        {planned > capacity && (
          <div className="absolute inset-y-0 w-0.5 bg-[var(--c-bg)]" style={{ left: pct(capacity) }} />
        )}
      </div>
      <p className="mt-1.5 text-[12px] text-[var(--c-muted)]">
        {planned === 0 ? "No chores planned today"
          : toGo === 0 ? `All done · ${done} pts`
          : `${done} done · ${toGo} to go${planned > capacity ? ` · ${planned - capacity} over` : ""}`}
      </p>
    </section>
  );
}
