import Link from "next/link";
import type { LogEntry, TrackableItem } from "@/lib/core/types";
import { complianceColor, dayCompliance, istToday } from "@/lib/core/logic";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** yyyy-mm-dd for the given year/month(0-based)/day, UTC-safe. */
function iso(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * A month grid (Mon–Sun) of day cells shaded by that day's compliance %.
 * `month` is "YYYY-MM". Server component — renders only <Link>s.
 */
export default function MonthCalendar({
  month, items, logs,
}: {
  month: string;
  items: TrackableItem[];
  logs: LogEntry[];
}) {
  const [y, m] = month.split("-").map(Number);
  const m0 = m - 1;
  const daysInMonth = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  // JS getUTCDay(): 0=Sun..6=Sat → convert to Mon=0..Sun=6 for leading blanks.
  const firstDow = (new Date(Date.UTC(y, m0, 1)).getUTCDay() + 6) % 7;
  const today = istToday();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-medium text-[var(--c-muted)]">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const dateISO = iso(y, m0, d);
          const future = dateISO > today;
          if (future) {
            return (
              <div key={dateISO}
                className="flex aspect-square items-center justify-center rounded-lg border border-[var(--c-border)] text-[13px] text-[var(--c-muted)] opacity-30">
                {d}
              </div>
            );
          }
          const { pct } = dayCompliance(items, logs, dateISO);
          // Neutral surface when nothing was due (or before any item existed).
          const bg = pct === null ? "var(--c-surface-2)" : complianceColor(pct);
          const ink = pct === null ? "var(--c-muted)" : "#04130c";
          return (
            <Link key={dateISO} href={`/day/${dateISO}`}
              aria-label={`${dateISO}${pct === null ? "" : ` — ${pct}%`}`}
              className="flex aspect-square items-center justify-center rounded-lg border border-[var(--c-border)] text-[13px] font-medium transition active:scale-90"
              style={{ background: bg, color: ink }}>
              {d}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
