import type { ReactNode } from "react";
import { Card, ProgressBar } from "./primitives";

export interface ProgressStat {
  label: string;
  value: ReactNode;
  /** CSS color for the value (e.g. "var(--c-done)"). */
  color?: string;
}

export interface ProgressCardProps {
  /** Header label, e.g. "Today's progress". */
  label: ReactNode;
  /** Percentage 0–100 shown big + used for the bar. */
  percent: number;
  /** Up-to-3 stat cells rendered in a row under the bar. */
  stats?: ProgressStat[];
  /** Override bar fill color. */
  barColor?: string;
  className?: string;
}

/**
 * Progress summary card. Ported from the "Today's progress" block in
 * web/app/(app)/page.tsx: label + % + progress bar + 3-up stat row.
 */
export function ProgressCard({
  label,
  percent,
  stats = [],
  barColor,
  className,
}: ProgressCardProps) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <Card className={className}>
      <div className="ds-progress-card__head">
        <span className="ds-progress-card__label">{label}</span>
        <span className="ds-progress-card__pct">{pct}%</span>
      </div>
      <div className="ds-progress-card__bar-wrap">
        <ProgressBar value={pct} color={barColor} />
      </div>
      {stats.length > 0 && (
        <div className="ds-progress-card__stats">
          {stats.map((s) => (
            <div key={s.label} className="ds-stat">
              <span className="ds-stat__value" style={{ color: s.color }}>
                {s.value}
              </span>
              <span className="ds-stat__label">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
