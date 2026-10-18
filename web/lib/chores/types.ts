/**
 * Chores domain types. Completions reuse the core `LogEntry` (itemId = chore id,
 * itemName = chore name, time = "") — the same append-only history the
 * supplement tracker uses, just in its own `chore_log` tab.
 */

/** ISO weekday: 1 = Monday … 5 = Friday. New chores are weekday-only. */
export type Weekday = 1 | 2 | 3 | 4 | 5;

export type ChoreFrequency = "weekly" | "biweekly";

/** Which alternate week a biweekly chore lands on (see WEEK_A_START). */
export type ChoreWeek = "A" | "B";

export interface Chore {
  id: string;
  name: string;
  /** Days of the week it's scheduled on, ascending. */
  days: Weekday[];
  frequency: ChoreFrequency;
  /** Only meaningful when frequency is "biweekly"; "A" otherwise. */
  week: ChoreWeek;
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
export type ChorePatch = Partial<Pick<Chore, "name" | "days" | "frequency" | "week" | "notes">>;

export interface NewChoreLog {
  choreId: string;
  choreName: string;
  /** ISO date; defaults to IST today. */
  date?: string;
}
