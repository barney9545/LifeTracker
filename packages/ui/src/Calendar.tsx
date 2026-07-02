import type { ReactNode } from "react";
import { Card } from "./primitives";
import { cx } from "./cx";
import { complianceColor } from "./tokens";

/* ── CalendarDayCell ─────────────────────────────────────────────────────── */
export interface CalendarDayCellProps {
  /** Day-of-month number, or null for a leading/trailing blank cell. */
  day: number | null;
  /**
   * Compliance percentage (0–100) used to color the background via
   * complianceColor(). Omit for a neutral cell.
   */
  compliance?: number;
  /** Explicit background override (wins over compliance). */
  color?: string;
  /** Muted text (e.g. days outside the current month). */
  muted?: boolean;
  className?: string;
}

export function CalendarDayCell({
  day,
  compliance,
  color,
  muted,
  className,
}: CalendarDayCellProps) {
  if (day == null) return <div className="ds-day ds-day--empty" aria-hidden />;
  const bg =
    color ?? (compliance != null ? complianceColor(compliance) : undefined);
  const empty = bg == null;
  return (
    <div
      className={cx("ds-day", (muted || empty) && "ds-day--muted", className)}
      style={bg ? { background: bg } : undefined}
    >
      {day}
    </div>
  );
}

/* ── MonthCalendar ───────────────────────────────────────────────────────── */
export interface MonthCalendarDay {
  day: number;
  compliance?: number;
  color?: string;
  muted?: boolean;
}

export interface MonthCalendarProps {
  /** Month title, e.g. "July 2026". */
  title: ReactNode;
  /**
   * Day descriptors in calendar order. Blank leading cells: set day to null,
   * or pass leadingBlanks to auto-pad.
   */
  days: Array<MonthCalendarDay | null>;
  /** Number of empty cells before the first day (to align weekday). */
  leadingBlanks?: number;
  /** Weekday header labels; defaults to S M T W T F S. */
  weekdays?: string[];
  onPrev?: () => void;
  onNext?: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
}

const DEFAULT_DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Month heatmap grid. 7-col grid of CalendarDayCell + title + ◀▶ nav. */
export function MonthCalendar({
  title,
  days,
  leadingBlanks = 0,
  weekdays = DEFAULT_DOW,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  className,
}: MonthCalendarProps) {
  const blanks = Array.from({ length: leadingBlanks }, () => null);
  const cells = [...blanks, ...days];
  return (
    <Card className={className}>
      <div className="ds-calendar__head">
        <button
          type="button"
          className="ds-calendar__nav"
          onClick={onPrev}
          disabled={prevDisabled}
          aria-label="Previous month"
        >
          ◀
        </button>
        <span className="ds-calendar__title">{title}</span>
        <button
          type="button"
          className="ds-calendar__nav"
          onClick={onNext}
          disabled={nextDisabled}
          aria-label="Next month"
        >
          ▶
        </button>
      </div>
      <div className="ds-calendar__grid">
        {weekdays.map((d, i) => (
          <div key={`dow-${i}`} className="ds-calendar__dow">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <CalendarDayCell
            key={i}
            day={c ? c.day : null}
            compliance={c?.compliance}
            color={c?.color}
            muted={c?.muted}
          />
        ))}
      </div>
    </Card>
  );
}
