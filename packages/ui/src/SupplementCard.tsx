import type { ChangeEvent, ReactNode } from "react";
import { CheckCircle } from "./primitives";
import { cx } from "./cx";
import { todColor, type TimeOfDay } from "./tokens";

export type SupplementVariant = "due" | "done" | "missed";

export interface SupplementCardProps {
  name: string;
  /** Secondary line, e.g. "Vitamin D3 · 60000 IU". */
  detail?: ReactNode;
  variant: SupplementVariant;

  /** DUE: colored left stripe by time of day. Defaults to "Anytime". */
  timeOfDay?: TimeOfDay | string;
  /** Explicit stripe color override (wins over timeOfDay). */
  stripeColor?: string;
  /** DUE: optional streak chip text, e.g. "🔥 7d". */
  streak?: ReactNode;
  /** DUE: fired when the outline check button is pressed. */
  onMarkDone?: () => void;

  /** DONE: time value "HH:MM" shown in the editable time input. */
  time?: string;
  /** DONE: fired when the time input changes. */
  onTimeChange?: (value: string) => void;
  /** DONE: fired when Undo is pressed. */
  onUndo?: () => void;

  /** MISSED: fired when "Mark taken" is pressed. */
  onMarkTaken?: () => void;

  /** Disables the interactive control (optimistic/pending states). */
  disabled?: boolean;
  className?: string;
}

/**
 * The brand card. Pure/presentational port of web/components/{due,done}-card.tsx
 * plus a new "missed" variant. Every interaction is a prop callback.
 */
export function SupplementCard(props: SupplementCardProps) {
  const { variant } = props;
  if (variant === "done") return <DoneVariant {...props} />;
  if (variant === "missed") return <MissedVariant {...props} />;
  return <DueVariant {...props} />;
}

function DueVariant({
  name,
  detail,
  timeOfDay = "Anytime",
  stripeColor,
  streak,
  onMarkDone,
  disabled,
  className,
}: SupplementCardProps) {
  const color = stripeColor ?? todColor(String(timeOfDay));
  return (
    <div className={cx("ds-supp", className)}>
      <span className="ds-supp__stripe" style={{ background: color }} />
      <div className="ds-supp__body">
        <div className="ds-supp__title-row">
          <span className="ds-supp__name">{name}</span>
          {streak ? <span className="ds-chip ds-chip--bare">{streak}</span> : null}
        </div>
        {detail != null && <p className="ds-supp__detail">{detail}</p>}
      </div>
      <button
        type="button"
        className="ds-check-btn"
        onClick={onMarkDone}
        disabled={disabled}
        aria-label={`Mark ${name} done`}
      >
        <CheckCircle />
      </button>
    </div>
  );
}

function DoneVariant({
  name,
  detail,
  time,
  onTimeChange,
  onUndo,
  disabled,
  className,
}: SupplementCardProps) {
  const editable = typeof onTimeChange === "function";
  return (
    <div className={cx("ds-supp", "ds-supp--done", className)}>
      <CheckCircle filled />
      <div className="ds-supp__body">
        <span className="ds-supp__name ds-supp__name--done">{name}</span>
        {detail != null && <p className="ds-supp__detail">{detail}</p>}
      </div>
      {editable ? (
        <input
          type="time"
          className="ds-time-input"
          value={time ?? ""}
          disabled={disabled}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onTimeChange?.(e.target.value)}
          aria-label={`Time taken for ${name}`}
        />
      ) : (
        time && <span className="ds-time-input" style={{ border: "none", background: "none" }}>{time}</span>
      )}
      <button
        type="button"
        className="ds-btn ds-btn--ghost"
        style={{ padding: "4px 10px", fontSize: 12 }}
        onClick={onUndo}
        disabled={disabled}
        aria-label={`Undo ${name}`}
      >
        Undo
      </button>
    </div>
  );
}

function MissedVariant({
  name,
  detail,
  onMarkTaken,
  disabled,
  className,
}: SupplementCardProps) {
  return (
    <div className={cx("ds-supp", className)}>
      <span className="ds-supp__stripe ds-supp__stripe--missed" />
      <div className="ds-supp__body">
        <div className="ds-supp__title-row">
          <span className="ds-supp__name ds-supp__name--missed">{name}</span>
        </div>
        {detail != null && <p className="ds-supp__detail">{detail}</p>}
      </div>
      <button
        type="button"
        className="ds-btn ds-btn--secondary"
        style={{ padding: "8px 12px", fontSize: 12 }}
        onClick={onMarkTaken}
        disabled={disabled}
      >
        Mark taken
      </button>
    </div>
  );
}
