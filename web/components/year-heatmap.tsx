"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { heatColor } from "@/lib/core/logic";

export interface HeatDay {
  date: string; // yyyy-mm-dd
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CELL = 13; // px
const GAP = 3; // px

/** Mon=0..Sun=6 for a yyyy-mm-dd date. */
function dow(dateISO: string): number {
  return (new Date(dateISO + "T00:00:00Z").getUTCDay() + 6) % 7;
}

/**
 * GitHub-contributions-style year heatmap. `days` is the full calendar year in
 * order (Jan 1 → Dec 31), each with a precomputed heat level. Landscape grid,
 * horizontally scrollable, auto-scrolled to today (the far right) on mount.
 */
export default function YearHeatmap({ days, today }: { days: HeatDay[]; today: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = todayRef.current;
    if (t) {
      // Bring today near the right edge so recent weeks are what you see first,
      // rather than the empty remainder of the calendar year.
      const delta = t.getBoundingClientRect().left - el.getBoundingClientRect().left;
      el.scrollLeft += delta - el.clientWidth + t.offsetWidth * 3;
    } else {
      el.scrollLeft = el.scrollWidth;
    }
  }, []);

  // Pad leading blanks so row 0 is Monday, then chunk into week columns.
  const cells: (HeatDay | null)[] = [];
  if (days.length) {
    for (let i = 0; i < dow(days[0].date); i++) cells.push(null);
  }
  cells.push(...days);
  const weeks: (HeatDay | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // Month label for a column = its first real day's month, when it changes.
  const monthLabels = weeks.map((week, i) => {
    const firstReal = week.find((c) => c !== null);
    if (!firstReal) return "";
    const mo = Number(firstReal.date.slice(5, 7)) - 1;
    const prev = weeks[i - 1]?.find((c) => c !== null);
    const prevMo = prev ? Number(prev.date.slice(5, 7)) - 1 : -1;
    return mo !== prevMo ? MONTHS[mo] : "";
  });

  return (
    <div ref={scrollRef} className="overflow-x-auto pb-1">
      <div className="inline-flex flex-col" style={{ gap: GAP }}>
        {/* month labels */}
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((_, i) => (
            <div key={i} className="text-[9px] text-[var(--c-muted)]"
              style={{ width: CELL, height: 12, overflow: "visible", whiteSpace: "nowrap" }}>
              {monthLabels[i]}
            </div>
          ))}
        </div>
        {/* week columns */}
        <div className="flex" style={{ gap: GAP }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col" style={{ gap: GAP }}>
              {week.map((cell, di) => {
                if (cell === null) {
                  return <div key={di} style={{ width: CELL, height: CELL }} />;
                }
                const isToday = cell.date === today;
                const ring = isToday ? "0 0 0 1.5px var(--c-accent)" : undefined;
                if (cell.future) {
                  return (
                    <div key={di} title={cell.date}
                      className="rounded-[3px] border border-dashed border-[var(--c-border)] opacity-40"
                      style={{ width: CELL, height: CELL, boxShadow: ring }} />
                  );
                }
                return (
                  <Link key={di} ref={isToday ? todayRef : undefined}
                    href={`/day/${cell.date}`} title={cell.date}
                    aria-label={cell.date}
                    className="rounded-[3px] transition active:scale-90"
                    style={{ width: CELL, height: CELL, background: heatColor(cell.level), boxShadow: ring }} />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
