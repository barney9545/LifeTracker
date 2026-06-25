/**
 * Tracker-agnostic scheduling/streak/compliance logic.
 * Ported faithfully from the Streamlit app.py (is_due, compute_streak,
 * streak_label, compliance) so behaviour — and the shared Google Sheet that
 * digest.gs reads — stays identical.
 */
import type { Frequency, LogEntry, TrackableItem } from "./types";

export const FREQ_DAYS: Record<Frequency, number> = {
  Daily: 1,
  "Every 2 Days": 2,
  "Every 3 Days": 3,
  Weekly: 7,
  "Twice Weekly": 3,
  Monthly: 30,
};

export const TIME_ORDER: Record<string, number> = {
  Morning: 0,
  Afternoon: 1,
  Evening: 2,
  Anytime: 3,
  "": 4,
};

export const FREQUENCIES = Object.keys(FREQ_DAYS) as Frequency[];

/** Local date as yyyy-mm-dd (matches how the sheet stores dates). */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Matches app.py is_due: by item NAME, using the most recent "done" date. */
export function isDue(item: TrackableItem, logs: LogEntry[]): boolean {
  const taken = logs.filter((l) => l.itemName === item.name && l.done);
  if (taken.length === 0) return true;
  const last = taken.reduce((mx, l) => (l.date > mx ? l.date : mx), taken[0].date);
  return daysBetween(todayISO(), last) >= (FREQ_DAYS[item.frequency] ?? 1);
}

/** Matches app.py already_logged_today: by item ID, today, done. */
export function alreadyDoneToday(itemId: string, logs: LogEntry[]): boolean {
  const t = todayISO();
  return logs.some((l) => l.itemId === itemId && l.date === t && l.done);
}

/** Matches app.py compute_streak: by item NAME, walking back by frequency interval. */
export function computeStreak(
  itemName: string,
  logs: LogEntry[],
  frequency: Frequency,
): number {
  const taken = logs.filter((l) => l.itemName === itemName && l.done);
  if (taken.length === 0) return 0;
  const interval = FREQ_DAYS[frequency] ?? 1;
  const dates = Array.from(new Set(taken.map((l) => l.date))).sort().reverse();
  let streak = 0;
  let check = todayISO();
  for (const d of dates) {
    if (daysBetween(check, d) <= interval) {
      streak += 1;
      check = d;
    } else break;
  }
  return streak;
}

export function streakLabel(n: number): string {
  if (n === 0) return "no streak";
  if (n >= 30) return `🔥🔥 ${n}d`;
  if (n >= 7) return `🔥 ${n}d`;
  return `✨ ${n}d`;
}

export function compliance(itemName: string, logs: LogEntry[]): {
  taken: number;
  total: number;
  pct: number;
} {
  const sl = logs.filter((l) => l.itemName === itemName);
  const total = sl.length;
  const taken = sl.filter((l) => l.done).length;
  const pct = total > 0 ? Math.round((taken / total) * 1000) / 10 : 0;
  return { taken, total, pct };
}

export function complianceColor(pct: number): string {
  if (pct >= 85) return "#4ade80";
  if (pct >= 60) return "#c4b8f0";
  if (pct >= 40) return "#fbbf24";
  return "#f87171";
}

/** Sort key helper for ordering by time of day (Morning→Anytime). */
export function timeOfDayRank(tod: string): number {
  return TIME_ORDER[tod] ?? 4;
}
