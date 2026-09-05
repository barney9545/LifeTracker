/**
 * Core domain types — deliberately tracker-agnostic so new trackers
 * (habits, etc.) reuse them. Tracker-specific fields live in `meta`.
 */

export type Frequency =
  | "Daily"
  | "Every 2 Days"
  | "Every 3 Days"
  | "Weekly"
  | "Twice Weekly"
  | "Monthly";

export type TimeOfDay = "Morning" | "Afternoon" | "Evening" | "Anytime";

export interface TrackableItem {
  id: string;
  name: string;
  active: boolean;
  frequency: Frequency;
  timeOfDay: TimeOfDay;
  notes: string;
  /** ISO date the item was added; used as the start of the compliance window.
   *  May be "" for legacy rows — callers fall back to the earliest log date. */
  addedDate: string;
  /** ISO date the item was last resumed after a pause. Used only as a scheduling
   *  anchor in `isDue` so a resumed item isn't instantly due; does NOT affect the
   *  compliance window or calendar history. "" / absent when never paused. */
  resumedDate?: string;
  /** Tracker-specific fields, e.g. supplements: dosage, unit, category, bestTakenWith. */
  meta: Record<string, string>;
}

export interface LogEntry {
  id: string;
  itemId: string;
  itemName: string;
  /** ISO date, yyyy-mm-dd. */
  date: string;
  done: boolean;
  /** HH:mm or free text. */
  time: string;
  notes: string;
}

export interface AiSummary {
  short: string;
  long: string;
  updatedAt: string;
}
