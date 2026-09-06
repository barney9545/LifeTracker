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

/** Format a given Date as yyyy-mm-dd in the server's local zone (generic helper). */
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * IST ("Asia/Kolkata") wall-clock helpers. The app is single-user in India, and
 * Vercel runs in UTC — bare `new Date()` there reads UTC, which is why a 14:47 IST
 * mark was logged as "09:17". `Intl.DateTimeFormat` with an explicit timeZone is
 * correct on BOTH Vercel (UTC) and local dev (already IST); the old `Date.now()+5.5h`
 * trick double-shifts in local dev, so it's avoided. These are pure (no server-only),
 * so client components can import `istNowHHMM` too.
 */
const IST = "Asia/Kolkata";

/** Today in IST as yyyy-mm-dd. Use this for all "today" comparisons + log dates. */
export function istToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date());
}

/** Current IST time as 24h HH:MM. */
export function istNowHHMM(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

/** Current IST hour (0–23). */
export function istHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: IST, hour: "2-digit", hour12: false }).format(new Date()),
  );
}

/** The IST date `n` days before today, as yyyy-mm-dd. */
export function daysAgoISO(n: number): string {
  return new Date(Date.parse(istToday() + "T00:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);
}

/** Human IST timestamp like "01 Jul, 08:00" (for ai_summary.updated_at). */
export function istStamp(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

/** Human IST date like "Wednesday, 01 July 2026" (digest header). */
export function istLongDate(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: IST, weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date());
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Matches app.py is_due: by item NAME, using the most recent "done" date.
 *
 * Scheduling anchor = the later of {last dose, resumedDate}. Resuming a paused
 * item restarts its schedule from the resume day, so it becomes due again only
 * after a full frequency interval elapses — not instantly (issue #8). Brand-new
 * items (never taken) are always due.
 */
export function isDue(item: TrackableItem, logs: LogEntry[]): boolean {
  const freq = FREQ_DAYS[item.frequency] ?? 1;
  const today = istToday();
  const taken = logs.filter((l) => l.itemName === item.name && l.done);

  // Scheduled resume (issue #14): once a scheduled item is activated, `resumeOn`
  // stays set as the cycle's start — that day IS a due day, and doses from before
  // it (pre-pause history) are ignored so it starts fresh on the chosen weekday.
  const start = /^\d{4}-\d{2}-\d{2}/.test(item.resumeOn ?? "") ? item.resumeOn!.slice(0, 10) : null;
  if (start) {
    const relevant = taken.filter((l) => l.date >= start);
    if (relevant.length === 0) return today >= start;
    const last = relevant.reduce((mx, l) => (l.date > mx ? l.date : mx), relevant[0].date);
    return daysBetween(today, last) >= freq;
  }

  if (taken.length === 0) return true;
  const last = taken.reduce((mx, l) => (l.date > mx ? l.date : mx), taken[0].date);
  const resumed = /^\d{4}-\d{2}-\d{2}/.test(item.resumedDate ?? "")
    ? item.resumedDate!.slice(0, 10)
    : null;
  const anchor = resumed && resumed > last ? resumed : last;
  return daysBetween(today, anchor) >= freq;
}

/** Matches app.py already_logged_today: by item ID, today, done. */
export function alreadyDoneToday(itemId: string, logs: LogEntry[]): boolean {
  const t = istToday();
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
  let check = istToday();
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

export interface ComplianceResult {
  /** Distinct days the item was taken within the window. */
  takenDays: number;
  /** Days the item was DUE within the window (by frequency, since it was added). */
  expectedDays: number;
  pct: number;
  /** Most recent date taken (ISO), or null if never. */
  lastTaken: string | null;
  /** Whole days since last taken (0 = today), or null if never. */
  daysSince: number | null;
}

/**
 * Day-based compliance, measured from when the item was added.
 *
 *   expectedDays = scheduled days due between start and today (by frequency)
 *   takenDays    = distinct days with a "done" log in that span
 *   pct          = takenDays / expectedDays  (capped at 100)
 *
 * start = the later of (addedDate, or earliest log if addedDate is unknown) and
 * the window edge (`windowDays` ago). So skipped days lower the score, and we
 * never penalise days before the item existed.
 */
export function complianceDays(
  item: TrackableItem,
  logs: LogEntry[],
  windowDays = 30,
): ComplianceResult {
  const doneDates = Array.from(
    new Set(logs.filter((l) => l.itemName === item.name && l.done).map((l) => l.date)),
  ).sort(); // ascending

  const today = istToday();
  const windowStart = daysAgoISO(windowDays - 1);

  const added = /^\d{4}-\d{2}-\d{2}/.test(item.addedDate ?? "")
    ? item.addedDate.slice(0, 10)
    : (doneDates[0] ?? today);
  const start = added > windowStart ? added : windowStart;

  const spanDays = Math.max(1, daysBetween(today, start) + 1);
  const freq = FREQ_DAYS[item.frequency] ?? 1;
  const expectedDays = Math.max(1, Math.ceil(spanDays / freq));
  const takenDays = doneDates.filter((d) => d >= start).length;
  const pct = Math.min(100, Math.round((takenDays / expectedDays) * 1000) / 10);

  const lastTaken = doneDates.length ? doneDates[doneDates.length - 1] : null;
  const daysSince = lastTaken ? daysBetween(today, lastTaken) : null;

  return { takenDays, expectedDays, pct, lastTaken, daysSince };
}

export function complianceColor(pct: number): string {
  if (pct >= 85) return "#4ade80";
  if (pct >= 60) return "#c4b8f0";
  if (pct >= 40) return "#fbbf24";
  return "#f87171";
}

/* ------------------------------------------------------------------ */
/* GitHub-contributions-style green heatmap scale (calendar + trends). */
/* No red: missed / nothing-due read as neutral, adherence reads green. */
/* ------------------------------------------------------------------ */

/** Map a day's compliance % (or null = nothing due) to a 0–4 heat bucket. */
export function heatLevel(pct: number | null): 0 | 1 | 2 | 3 | 4 {
  if (pct === null || pct <= 0) return 0;
  if (pct < 40) return 1;
  if (pct < 70) return 2;
  if (pct < 100) return 3;
  return 4;
}

/** CSS colour for a heat bucket: neutral surface → shades of green. */
export function heatColor(level: 0 | 1 | 2 | 3 | 4): string {
  switch (level) {
    case 1: return "rgba(34,197,94,0.25)";
    case 2: return "rgba(34,197,94,0.45)";
    case 3: return "rgba(34,197,94,0.70)";
    case 4: return "#22c55e";
    default: return "var(--c-surface-2)";
  }
}

/**
 * Sort key helper for ordering by time of day (Morning→Anytime).
 * Tolerant of dirty sheet values: trims whitespace and matches
 * case-insensitively, so " morning" / "Evening " still rank into the right
 * slot instead of silently sinking to the bottom (issue #7).
 */
export function timeOfDayRank(tod: string): number {
  const key = (tod ?? "").trim();
  if (key in TIME_ORDER) return TIME_ORDER[key];
  const lower = key.toLowerCase();
  for (const k of Object.keys(TIME_ORDER)) {
    if (k && k.toLowerCase() === lower) return TIME_ORDER[k];
  }
  return 4;
}

/* ------------------------------------------------------------------ */
/* Frequency-aware historical status (for the calendar + day pages).   */
/* ------------------------------------------------------------------ */

/** The earliest "done" log date for an item, or null if never taken. */
function earliestDoneDate(item: TrackableItem, logs: LogEntry[]): string | null {
  let min: string | null = null;
  for (const l of logs) {
    if (l.itemName === item.name && l.done && (min === null || l.date < min)) min = l.date;
  }
  return min;
}

/** The effective "added" date: the stamped addedDate, else the earliest log (legacy rows). */
function effectiveAdded(item: TrackableItem, logs: LogEntry[]): string | null {
  if (/^\d{4}-\d{2}-\d{2}/.test(item.addedDate ?? "")) return item.addedDate.slice(0, 10);
  return earliestDoneDate(item, logs);
}

/** Did the item exist on `dateISO`? (addedDate <= dateISO, fallback to earliest log.) */
export function existedOn(item: TrackableItem, logs: LogEntry[], dateISO: string): boolean {
  const added = effectiveAdded(item, logs);
  if (added === null) return false; // no addedDate and never logged → treat as not-yet-existing
  return added <= dateISO;
}

export type DayStatus = "taken" | "missed" | "notdue" | "before";

/**
 * Status of an item on a specific past/current day, frequency-aware.
 * `doneDates` is the item's set of distinct done-dates (yyyy-mm-dd).
 * - `before`  — the item didn't exist yet.
 * - `taken`   — there's a done log on that exact day.
 * - `missed`  — it was due that day (no prior take within the frequency window) but not taken.
 * - `notdue`  — a prior take covers that day (within the frequency interval).
 */
export function statusOnDay(
  item: TrackableItem,
  doneDates: Set<string>,
  dateISO: string,
): DayStatus {
  // Effective added date: stamped addedDate wins; else earliest done date (legacy rows).
  let added: string | null = null;
  if (/^\d{4}-\d{2}-\d{2}/.test(item.addedDate ?? "")) {
    added = item.addedDate.slice(0, 10);
  } else {
    for (const d of doneDates) if (added === null || d < added) added = d;
  }
  if (added === null || added > dateISO) return "before";
  if (doneDates.has(dateISO)) return "taken";

  // Find the most recent take STRICTLY before dateISO.
  let lastPrior: string | null = null;
  for (const d of doneDates) {
    if (d < dateISO && (lastPrior === null || d > lastPrior)) lastPrior = d;
  }
  const freq = FREQ_DAYS[item.frequency] ?? 1;
  if (lastPrior === null) return "missed"; // due since it existed, never taken before
  return daysBetween(dateISO, lastPrior) >= freq ? "missed" : "notdue";
}

export interface DayBucketEntry {
  item: TrackableItem;
  logId: string;
  time: string;
}

export interface DayBuckets {
  taken: DayBucketEntry[];
  missed: TrackableItem[];
  notDue: TrackableItem[];
}

/**
 * Bucket the given (currently-active) items into taken/missed/notDue for `dateISO`.
 * Builds each item's done-date set once for efficiency. Items that didn't exist
 * on the day are excluded entirely.
 */
export function dayBuckets(
  items: TrackableItem[],
  logs: LogEntry[],
  dateISO: string,
): DayBuckets {
  const buckets: DayBuckets = { taken: [], missed: [], notDue: [] };
  for (const item of items) {
    const done = logs.filter((l) => l.itemName === item.name && l.done);
    const doneDates = new Set(done.map((l) => l.date));
    const status = statusOnDay(item, doneDates, dateISO);
    if (status === "before") continue;
    if (status === "taken") {
      // Prefer the last log on that date (mirrors the Today page's choice).
      const onDay = done.filter((l) => l.date === dateISO);
      const last = onDay.length ? onDay[onDay.length - 1] : null;
      buckets.taken.push({ item, logId: last?.id ?? "", time: last?.time ?? "" });
    } else if (status === "missed") {
      buckets.missed.push(item);
    } else {
      buckets.notDue.push(item);
    }
  }
  return buckets;
}

/** Compliance for a single day: taken ÷ due; pct is null when nothing was due. */
export function dayCompliance(
  items: TrackableItem[],
  logs: LogEntry[],
  dateISO: string,
): { due: number; taken: number; pct: number | null } {
  const b = dayBuckets(items, logs, dateISO);
  const due = b.taken.length + b.missed.length;
  const taken = b.taken.length;
  const pct = due > 0 ? Math.round((taken / due) * 100) : null;
  return { due, taken, pct };
}

/* ------------------------------------------------------------------ */
/* Forward schedule projection (for tapping FUTURE calendar dates).     */
/* Read-only: "if I keep taking things on schedule, what lands here?"   */
/* ------------------------------------------------------------------ */

/** The most recent "done" date for an item, or null if never taken. */
function lastDoneDate(item: TrackableItem, logs: LogEntry[]): string | null {
  let max: string | null = null;
  for (const l of logs) {
    if (l.itemName === item.name && l.done && (max === null || l.date > max)) max = l.date;
  }
  return max;
}

/**
 * Whether an active item is projected to be due on a FUTURE date, phase-locked
 * to its schedule anchor. anchor = latest of {last dose, resumedDate}, else the
 * effective added date, else today. Due iff `dateISO` is a whole number of
 * frequency intervals after the anchor. (Daily → every future day.)
 */
export function projectedDueOn(
  item: TrackableItem,
  logs: LogEntry[],
  dateISO: string,
): boolean {
  const freq = FREQ_DAYS[item.frequency] ?? 1;
  // A scheduled-resume item (issue #14) projects from its resume date's phase.
  const start = /^\d{4}-\d{2}-\d{2}/.test(item.resumeOn ?? "") ? item.resumeOn!.slice(0, 10) : null;
  if (start) {
    return dateISO >= start && daysBetween(dateISO, start) % freq === 0;
  }
  const last = lastDoneDate(item, logs);
  const resumed = /^\d{4}-\d{2}-\d{2}/.test(item.resumedDate ?? "")
    ? item.resumedDate!.slice(0, 10)
    : null;
  const added = effectiveAdded(item, logs);
  const candidates = [last, resumed, added].filter((d): d is string => d !== null);
  const anchor = candidates.length ? candidates.reduce((mx, d) => (d > mx ? d : mx)) : istToday();
  if (dateISO <= anchor) return false;
  return daysBetween(dateISO, anchor) % freq === 0;
}

/** Active items projected to be due on a future date, sorted by time of day. */
export function projectedDueItems(
  items: TrackableItem[],
  logs: LogEntry[],
  dateISO: string,
): TrackableItem[] {
  return items
    .filter((it) => projectedDueOn(it, logs, dateISO))
    .sort((a, b) => timeOfDayRank(a.timeOfDay) - timeOfDayRank(b.timeOfDay) || a.name.localeCompare(b.name));
}
