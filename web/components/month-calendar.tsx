import Link from "next/link";
import type { LogEntry, TrackableItem } from "@/lib/core/types";
import { dayCompliance, heatColor, heatLevel, istToday } from "@/lib/core/logic";

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
            // Tappable: opens the read-only projected "what's scheduled" view.
            return (
              <Link key={dateISO} href={`/day/${dateISO}`}
                aria-label={`${dateISO} — upcoming`}
                className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[var(--c-border)] text-[13px] text-[var(--c-muted)] opacity-60 transition active:scale-90">
                {d}
              </Link>
            );
          }
          const { pct } = dayCompliance(items, logs, dateISO);
          const level = heatLevel(pct);
          const ink = level >= 3 ? "#04130c" : level === 0 ? "var(--c-muted)" : "var(--c-text)";
          return (
            <Link key={dateISO} href={`/day/${dateISO}`}
              aria-label={`${dateISO}${pct === null ? "" : ` — ${pct}%`}`}
              className="flex aspect-square items-center justify-center rounded-lg border border-[var(--c-border)] text-[13px] font-medium transition active:scale-90"
              style={{ background: heatColor(level), color: ink }}>
              {d}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
