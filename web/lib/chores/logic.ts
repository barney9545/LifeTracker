/**
 * Chore scheduling — pure functions, no I/O, no clock. Every function takes the
 * reference date explicitly so the UI, the nightly reminder and the tests all
 * share one definition of "due". (Only type imports, so `node --test` can load
 * this file directly.)
 *
 * Rules:
 *  - A chore repeats on fixed weekdays: weekly, every two weeks, or monthly on
 *    the Nth (or last) such weekday. The schedule never shifts based on when it
 *    was actually done.
 *  - Two-week chores alternate A/B weeks, anchored on WEEK_A_START.
 *  - A scheduled day with no completion on/after it stays "outstanding" until the
 *    chore is marked done; one completion clears every outstanding occurrence up
 *    to that day (a missed Monday + Thursday laundry shows once, overdue since Mon).
 *  - A completion never counts toward a later scheduled day (no doing it early).
 *  - Nothing before the chore's schedule start (added / resumed) is ever overdue.
 *  - One-off moves (`ChoreMove`) shift a single occurrence to another date without
 *    touching the pattern; every "is it on this day" check goes through `occursOn`.
 *  - Capacity: each chore has effort points; a day's load is the sum of points of
 *    the chores on it, measured against a daily capacity (default 100).
 */
import type { LogEntry } from "../core/types";
import type { Chore, ChoreMove, ChoreWeek, MonthWeek, StoredChoreMove, Weekday } from "./types";

/** Monday of the first "A" week. Two-week chores alternate A/B from here. */
export const WEEK_A_START = "2026-10-19";

export const DEFAULT_POINTS = 10;
export const DEFAULT_CAPACITY = 100;
/** How many days ahead "lightest day" looks. */
export const LIGHTEST_DAY_WINDOW = 7;

/** How far back overdue detection looks; callers should fetch at least this many days of chore logs. */
export const CHORE_LOG_DAYS = 60;

export const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5, 6, 7];
export const MONTH_WEEKS: MonthWeek[] = [1, 2, 3, 4, -1];
export const MONTH_WEEK_LABELS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "Last" };
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

/** Whether `iso` is the Nth (or, for -1, the last) of its weekday in its month. */
export function isMonthWeek(iso: string, n: MonthWeek): boolean {
  const day = Number(iso.slice(8, 10));
  if (n === -1) return addDaysISO(iso, 7).slice(5, 7) !== iso.slice(5, 7);
  return Math.ceil(day / 7) === n;
}

/** Whether the chore's pattern lands on `iso` (ignores active / start date). */
export function isScheduledOn(chore: Chore, iso: string): boolean {
  if (!chore.days.includes(weekdayOf(iso) as Weekday)) return false;
  if (chore.frequency === "monthly") return isMonthWeek(iso, chore.monthWeek);
  return chore.frequency === "weekly" || weekOf(iso) === chore.week;
}

/** This chore's moves (all moves are passed around together; filtered here). */
function movesOf(chore: Chore, moves: StoredChoreMove[]): StoredChoreMove[] {
  return moves.filter((m) => m.choreId === chore.id);
}

/** Pattern + one-off moves: on its pattern day unless moved away, or moved onto this day. */
export function occursOn(chore: Chore, iso: string, moves: StoredChoreMove[] = []): boolean {
  const mine = movesOf(chore, moves);
  if (mine.some((m) => m.toDate === iso)) return true;
  return isScheduledOn(chore, iso) && !mine.some((m) => m.fromDate === iso);
}

/** The original date an occurrence on `iso` was moved from, or null if it wasn't moved. */
export function movedFrom(chore: Chore, iso: string, moves: StoredChoreMove[] = []): string | null {
  return movesOf(chore, moves).find((m) => m.toDate === iso)?.fromDate ?? null;
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

/** Due on exactly this date: active then, on or after its start, and it occurs here. */
export function isDueOn(chore: Chore, iso: string, moves: StoredChoreMove[] = []): boolean {
  return isActiveOn(chore, iso) && iso >= scheduleStart(chore) && occursOn(chore, iso, moves);
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
 * Every occurrence day (≤ asOf, oldest first) not yet covered by a completion.
 * Empty when the chore is all caught up. Rescheduling an overdue chore moves all of these.
 */
export function outstandingDates(
  chore: Chore, logs: LogEntry[], asOf: string, moves: StoredChoreMove[] = [],
): string[] {
  if (!isActiveOn(chore, asOf)) return [];
  const lastDone = lastDoneOnOrBefore(chore, logs, asOf);
  let from = scheduleStart(chore);
  if (lastDone && addDaysISO(lastDone, 1) > from) from = addDaysISO(lastDone, 1);
  const floor = addDaysISO(asOf, -CHORE_LOG_DAYS);
  if (from < floor) from = floor;
  const out: string[] = [];
  for (let d = from; d <= asOf; d = addDaysISO(d, 1)) {
    if (occursOn(chore, d, moves)) out.push(d);
  }
  return out;
}

/**
 * The earliest occurrence day (≤ asOf) not yet covered by a completion, or null if
 * the chore is all caught up. `since < asOf` → overdue; `since === asOf` → due today.
 */
export function outstandingSince(
  chore: Chore, logs: LogEntry[], asOf: string, moves: StoredChoreMove[] = [],
): string | null {
  return outstandingDates(chore, logs, asOf, moves)[0] ?? null;
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
export function choresForDay(
  chores: Chore[], logs: LogEntry[], today: string, moves: StoredChoreMove[] = [],
): ChoreDay {
  const out: ChoreDay = { overdue: [], due: [], done: [] };
  const byName = (a: Chore, b: Chore) => a.name.localeCompare(b.name);
  for (const chore of [...chores].sort(byName)) {
    if (!isActiveOn(chore, today)) continue; // paused chores never appear, even if done today
    const doneToday = logs.filter((l) => l.itemId === chore.id && l.done && l.date === today);
    if (doneToday.length) {
      out.done.push({ chore, logId: doneToday[doneToday.length - 1].id });
      continue;
    }
    const since = outstandingSince(chore, logs, today, moves);
    if (since === null) continue;
    if (since < today) out.overdue.push({ chore, since });
    else out.due.push(chore);
  }
  out.overdue.sort((a, b) => a.since.localeCompare(b.since) || byName(a.chore, b.chore));
  return out;
}

/** Active chores due on `iso` (by pattern + moves + start), sorted by name. */
export function choresDueOn(chores: Chore[], iso: string, moves: StoredChoreMove[] = []): Chore[] {
  return chores.filter((c) => isDueOn(c, iso, moves)).sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ */
/* One-off moves                                                       */
/* ------------------------------------------------------------------ */

/**
 * A chore's move list after moving its occurrences on `fromDates` to `to`. Pure:
 * the caller saves the result (and keeps the old list for undo).
 *  - An occurrence that was itself moved in is re-targeted (no chains), and the
 *    move is dropped entirely when it lands back on its original day.
 *  - Moving onto a day it already occurs merges them (one completion covers it).
 *    Moving such a merged day later moves BOTH occurrences — which needs
 *    `isPatternDay` (pass `(d) => isScheduledOn(chore, d)`) to see the pattern one.
 */
export function applyMove(
  moves: ChoreMove[], fromDates: string[], to: string, isPatternDay: (iso: string) => boolean = () => false,
): ChoreMove[] {
  const out = moves.map((m) => ({ fromDate: m.fromDate, toDate: m.toDate }));
  for (const from of fromDates) {
    if (from === to) continue;
    const movedIn = out.filter((m) => m.toDate === from);
    for (const m of movedIn) m.toDate = to;
    // The pattern occurrence on this day (if any, and not already moved away) goes too.
    const patternHere = movedIn.length ? isPatternDay(from) : true;
    if (patternHere && !out.some((m) => m.fromDate === from)) {
      out.push({ fromDate: from, toDate: to });
    }
  }
  const kept = out.filter((m) => m.fromDate !== m.toDate);
  // De-duplicate identical moves.
  return kept.filter((m, i) => kept.findIndex((n) => n.fromDate === m.fromDate && n.toDate === m.toDate) === i);
}

/* ------------------------------------------------------------------ */
/* Capacity                                                            */
/* ------------------------------------------------------------------ */

/** A chore's effort points, falling back to DEFAULT_POINTS for missing / invalid values. */
export const pointsOf = (c: Chore) => (Number.isFinite(c.points) && c.points >= 0 ? c.points : DEFAULT_POINTS);

/** Planned load for a date: points of every chore that occurs on it. */
export function plannedLoadOn(chores: Chore[], iso: string, moves: StoredChoreMove[] = []): number {
  return choresDueOn(chores, iso, moves).reduce((sum, c) => sum + pointsOf(c), 0);
}

/** Actual load for a (past) date: points of the chores marked done that day. */
export function completedLoadOn(chores: Chore[], logs: LogEntry[], iso: string): number {
  const ids = new Set(logs.filter((l) => l.done && l.date === iso).map((l) => l.itemId));
  return chores.filter((c) => ids.has(c.id)).reduce((sum, c) => sum + pointsOf(c), 0);
}

/** Today's load from the Today buckets: everything owed today (overdue + due + done) and the done part. */
export function todayLoad(day: ChoreDay): { planned: number; done: number } {
  const done = day.done.reduce((s, d) => s + pointsOf(d.chore), 0);
  const owed = [...day.overdue.map((o) => o.chore), ...day.due].reduce((s, c) => s + pointsOf(c), 0);
  return { planned: owed + done, done };
}

/** 0 = nothing, 1 = comfortable (< 70%), 2 = busy (70–100%), 3 = over capacity. */
export function capacityLevel(load: number, capacity: number): 0 | 1 | 2 | 3 {
  if (load <= 0) return 0;
  const pct = (load / Math.max(1, capacity)) * 100;
  if (pct > 100) return 3;
  if (pct >= 70) return 2;
  return 1;
}

/**
 * Best day to move one occurrence of `chore` (currently on `fromISO`) to: the next
 * LIGHTEST_DAY_WINDOW days after max(fromISO, today), skipping days it already occurs.
 * Ranked: fits within capacity → weekday (preferred over weekends) → lowest load → earliest.
 * `load` is the day's load BEFORE adding this chore.
 */
export function lightestDay(
  chores: Chore[], moves: StoredChoreMove[], chore: Chore, fromISO: string, today: string, capacity: number,
): { date: string; load: number } | null {
  const start = fromISO > today ? fromISO : today;
  const pts = pointsOf(chore);
  let best: { date: string; load: number; fits: boolean; weekday: boolean } | null = null;
  for (let i = 1; i <= LIGHTEST_DAY_WINDOW; i++) {
    const date = addDaysISO(start, i);
    if (occursOn(chore, date, moves)) continue;
    const load = plannedLoadOn(chores, date, moves);
    const cand = { date, load, fits: load + pts <= capacity, weekday: weekdayOf(date) <= 5 };
    const better = !best
      || (cand.fits !== best.fits ? cand.fits
        : cand.weekday !== best.weekday ? cand.weekday
        : cand.load < best.load);
    if (better) best = cand;
  }
  return best ? { date: best.date, load: best.load } : null;
}

/** "Mon, Thu · weekly" / "Wed · every 2 weeks (B)" / "1st Mon · monthly". */
export function describeSchedule(chore: Chore): string {
  const days = chore.days.map((d) => WEEKDAY_LABELS[d]).join(", ") || "No days";
  if (chore.frequency === "monthly") return `${MONTH_WEEK_LABELS[chore.monthWeek] ?? "1st"} ${days} · monthly`;
  return chore.frequency === "biweekly" ? `${days} · every 2 weeks (${chore.week})` : `${days} · weekly`;
}
