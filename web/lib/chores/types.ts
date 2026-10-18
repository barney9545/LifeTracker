/**
 * Chores domain types. Completions reuse the core `LogEntry` (itemId = chore id,
 * itemName = chore name, time = "") — the same append-only history the
 * supplement tracker uses, just in its own `chore_log` tab.
 */

/** ISO weekday: 1 = Monday … 7 = Sunday. (Weekdays are preferred, weekends allowed.) */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ChoreFrequency = "weekly" | "biweekly" | "monthly";

/** Which occurrence of the weekday in the month a monthly chore lands on; -1 = last. */
export type MonthWeek = 1 | 2 | 3 | 4 | -1;

/** Which alternate week a biweekly chore lands on (see WEEK_A_START). */
export type ChoreWeek = "A" | "B";

export interface Chore {
  id: string;
  name: string;
  /** Days of the week it's scheduled on, ascending. Monthly chores use exactly one. */
  days: Weekday[];
  frequency: ChoreFrequency;
  /** Only meaningful when frequency is "biweekly"; "A" otherwise. */
  week: ChoreWeek;
  /** Only meaningful when frequency is "monthly" (e.g. 1 + Mon = "1st Monday"); 1 otherwise. */
  monthWeek: MonthWeek;
  /** Effort points counted against the day's capacity (default 10). */
  points: number;
  active: boolean;
  notes: string;
  /** ISO date the chore was added — nothing before it is ever overdue. */
  addedDate: string;
  /** ISO date last resumed after a pause — restarts the overdue window (like supplements). */
  resumedDate?: string;
  /** ISO date a paused chore auto-resumes. Paused until then; from that day it's
   *  treated as active and that day starts its overdue window. "" when unset. */
  resumeOn?: string;
}

export type NewChore = Omit<Chore, "id" | "addedDate" | "resumedDate" | "resumeOn">;
export type ChorePatch = Partial<Pick<Chore, "name" | "days" | "frequency" | "week" | "monthWeek" | "points" | "notes">>;

export interface NewChoreLog {
  choreId: string;
  choreName: string;
  /** ISO date; defaults to IST today. */
  date?: string;
}

/**
 * A one-off reschedule of a single occurrence: the chore doesn't happen on
 * `fromDate` and happens on `toDate` instead. The repeating schedule is untouched.
 * Lists are built by `applyMove`, which re-targets moved-in occurrences instead of chaining.
 */
export interface ChoreMove {
  fromDate: string;
  toDate: string;
}

export interface StoredChoreMove extends ChoreMove {
  choreId: string;
}
