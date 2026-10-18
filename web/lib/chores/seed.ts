import type { NewChore } from "./types";

/** Starting chore list. Seeded once, when the store has no chores tab yet.
 *  All start on WEEK_A_START (Mon 19 Oct 2026) so nothing is overdue on day one.
 *  Friday is left free as a catch-up day. (Type-only imports so tests can load it.) */
export const SEED_START = "2026-10-19";

export const SEED_CHORES: NewChore[] = [
  { name: "Laundry", days: [1, 4], frequency: "weekly", week: "A", monthWeek: 1, points: 10, active: true, notes: "" },
  { name: "Wash bottle", days: [1, 4], frequency: "weekly", week: "A", monthWeek: 1, points: 10, active: true, notes: "" },
  { name: "Trim nails", days: [2], frequency: "weekly", week: "A", monthWeek: 1, points: 10, active: true, notes: "" },
  { name: "Clean beard", days: [2], frequency: "weekly", week: "A", monthWeek: 1, points: 10, active: true, notes: "" },
  { name: "Change bed sheets & pillow covers", days: [3], frequency: "biweekly", week: "A", monthWeek: 1, points: 10, active: true, notes: "" },
  { name: "Trim nose hair", days: [3], frequency: "biweekly", week: "B", monthWeek: 1, points: 10, active: true, notes: "" },
];
