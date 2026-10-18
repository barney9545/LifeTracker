/**
 * Chore scheduling — pure functions, no I/O, no clock. Every function takes the
 * reference date explicitly so the UI, the nightly reminder and the tests all
 * share one definition of "due". (Only type imports, so `node --test` can load
 * this file directly.)
 *
 * Rules:
 *  - A chore repeats on fixed weekdays, weekly or every two weeks. The schedule
 *    never shifts based on when it was actually done.
 *  - Two-week chores alternate A/B weeks, anchored on WEEK_A_START.
 *  - A scheduled day with no completion on/after it stays "outstanding" until the
 *    chore is marked done; one completion clears every outstanding occurrence up
 *    to that day (a missed Monday + Thursday laundry shows once, overdue since Mon).
 *  - A completion never counts toward a later scheduled day (no doing it early).
 *  - Nothing before the chore's schedule start (added / resumed) is ever overdue.
 */
import type { LogEntry } from "../core/types";
import type { Chore, ChoreWeek, Weekday } from "./types";

/** Monday of the first "A" week. Two-week chores alternate A/B from here. */
export const WEEK_A_START = "2026-10-19";

/** How far back overdue detection looks; callers should fetch at least this many days of chore logs. */
export const CHORE_LOG_DAYS = 60;

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];
export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 7: "Sun",
};

const ISO = /^\d{4}-\d{2}-\d{2}/;
const DAY_MS = 86_400_000;

function toUTC(iso: string): number {
  return Date.parse(iso.slice(0, 10) + "T00:00:00Z");
}

/** `iso` shifted by `n` days (n may be negative). */
export function addDaysISO(iso: string, n: number): string {
  return new Date(toUTC(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from b to a (a − b). */
function diffDays(a: string, b: string): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

/** ISO weekday of a date: 1 = Mon … 7 = Sun. */
export function weekdayOf(iso: string): number {
  const d = new Date(toUTC(iso)).getUTCDay(); // 0 = Sun
  return d === 0 ? 7 : d;
}

/** Whether `iso` falls in an A or B week (weeks run Mon–Sun). */
export function weekOf(iso: string): ChoreWeek {
  const monday = addDaysISO(iso, 1 - weekdayOf(iso));
  const weeks = Math.round(diffDays(monday, WEEK_A_START) / 7);
  return ((weeks % 2) + 2) % 2 === 0 ? "A" : "B";
}

/** Whether the chore's pattern lands on `iso` (ignores active / start date). */
export function isScheduledOn(chore: Chore, iso: string): boolean {
  if (!chore.days.includes(weekdayOf(iso) as Weekday)) return false;
  return chore.frequency === "weekly" || weekOf(iso) === chore.week;
}

/** Active on `iso`: switched on, or a scheduled resume date has arrived. */
export function isActiveOn(chore: Chore, iso: string): boolean {
  if (chore.active) return true;
  const on = chore.resumeOn ?? "";
  return ISO.test(on) && on.slice(0, 10) <= iso;
}

/** First day the chore can be due: the latest of added / resumed / scheduled-resume dates. */
export function scheduleStart(chore: Chore): string {
  const dates = [chore.addedDate, chore.resumedDate ?? "", chore.resumeOn ?? ""]
    .filter((d) => ISO.test(d))
    .map((d) => d.slice(0, 10));
  return dates.length ? dates.reduce((mx, d) => (d > mx ? d : mx)) : "0000-01-01";
}

/** Due on exactly this date: active then, on or after its start, and the pattern lands here. */
export function isDueOn(chore: Chore, iso: string): boolean {
  return isActiveOn(chore, iso) && iso >= scheduleStart(chore) && isScheduledOn(chore, iso);
}

/** Latest done date for this chore on or before `asOf`, or null. Matched by chore id. */
function lastDoneOnOrBefore(chore: Chore, logs: LogEntry[], asOf: string): string | null {
  let max: string | null = null;
  for (const l of logs) {
    if (l.itemId === chore.id && l.done && l.date <= asOf && (max === null || l.date > max)) max = l.date;
  }
  return max;
}

/**
 * The earliest scheduled day (≤ asOf) not yet covered by a completion, or null if
 * the chore is all caught up. `since < asOf` → overdue; `since === asOf` → due today.
 */
export function outstandingSince(chore: Chore, logs: LogEntry[], asOf: string): string | null {
  if (!isActiveOn(chore, asOf)) return null;
  const lastDone = lastDoneOnOrBefore(chore, logs, asOf);
  let from = scheduleStart(chore);
  if (lastDone && addDaysISO(lastDone, 1) > from) from = addDaysISO(lastDone, 1);
  const floor = addDaysISO(asOf, -CHORE_LOG_DAYS);
  if (from < floor) from = floor;
  for (let d = from; d <= asOf; d = addDaysISO(d, 1)) {
    if (isScheduledOn(chore, d)) return d;
  }
  return null;
}

export interface ChoreDay {
  /** Missed on an earlier day and still not done (oldest first). */
  overdue: { chore: Chore; since: string }[];
  /** Scheduled today, not done yet. */
  due: Chore[];
  /** Marked done today (logId of the latest completion, for undo). */
  done: { chore: Chore; logId: string }[];
}

/** Everything the Today view needs for `today`. */
export function choresForDay(chores: Chore[], logs: LogEntry[], today: string): ChoreDay {
  const out: ChoreDay = { overdue: [], due: [], done: [] };
  const byName = (a: Chore, b: Chore) => a.name.localeCompare(b.name);
  for (const chore of [...chores].sort(byName)) {
    if (!isActiveOn(chore, today)) continue; // paused chores never appear, even if done today
    const doneToday = logs.filter((l) => l.itemId === chore.id && l.done && l.date === today);
    if (doneToday.length) {
      out.done.push({ chore, logId: doneToday[doneToday.length - 1].id });
      continue;
    }
    const since = outstandingSince(chore, logs, today);
    if (since === null) continue;
    if (since < today) out.overdue.push({ chore, since });
    else out.due.push(chore);
  }
  out.overdue.sort((a, b) => a.since.localeCompare(b.since) || byName(a.chore, b.chore));
  return out;
}

/** Active chores due on `iso` (by pattern + start), sorted by name. */
export function choresDueOn(chores: Chore[], iso: string): Chore[] {
  return chores.filter((c) => isDueOn(c, iso)).sort((a, b) => a.name.localeCompare(b.name));
}

/** "Mon, Thu · weekly" / "Wed · every 2 weeks (B)". */
export function describeSchedule(chore: Chore): string {
  const days = chore.days.map((d) => WEEKDAY_LABELS[d]).join(", ") || "No days";
  return chore.frequency === "biweekly" ? `${days} · every 2 weeks (${chore.week})` : `${days} · weekly`;
}
