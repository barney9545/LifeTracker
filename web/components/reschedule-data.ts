/*
 * Shared (server + client) helpers for rescheduling a chore from Home. Plain
 * module — no "use client" — so the server panel can call these and the client
 * cards can import the types and formatter.
 */
import { addDaysISO, applyMove, isScheduledOn, lightestDay, plannedLoadOn } from "@/lib/chores/logic";
import type { Chore, StoredChoreMove } from "@/lib/chores/types";

/** How far ahead "Pick a date" reaches (and how many day loads are precomputed). */
export const RESCHEDULE_DAYS = 60;

/** "Mon 19 Oct" for an ISO date (formatted in UTC so the day never shifts). */
export function shortDay(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

/** One outstanding chore on Home, with what its reschedule popup needs. */
export interface ChoreItem {
  id: string;
  name: string;
  detail: string;
  /** "Mon 19 Oct" when it was missed on an earlier day. */
  overdueSince?: string;
  /** "Mon 19 Oct" when this occurrence was moved onto today from that day. */
  movedFrom?: string;
  /** The occurrences a reschedule moves: today, or every missed day of an overdue chore. */
  fromDates: string[];
  /** Day → load if the chore were moved there (tomorrow … RESCHEDULE_DAYS ahead). */
  loads: Record<string, number>;
  /** Suggested lightest day in the next week, or null. */
  lightest: string | null;
}

/**
 * Each upcoming day's load as it would be AFTER moving `fromDates` there — the
 * same applyMove the action uses, so merges and points match what gets saved.
 */
export function rescheduleChoices(
  chores: Chore[], moves: StoredChoreMove[], chore: Chore, fromDates: string[], today: string, capacity: number,
): Pick<ChoreItem, "loads" | "lightest"> {
  const others = moves.filter((m) => m.choreId !== chore.id);
  const mine = moves.filter((m) => m.choreId === chore.id).map(({ fromDate, toDate }) => ({ fromDate, toDate }));
  const loads: Record<string, number> = {};
  for (let i = 1; i <= RESCHEDULE_DAYS; i++) {
    const to = addDaysISO(today, i);
    const after = [
      ...others,
      ...applyMove(mine, fromDates, to, (d) => isScheduledOn(chore, d)).map((m) => ({ ...m, choreId: chore.id })),
    ];
    loads[to] = plannedLoadOn(chores, to, after);
  }
  return { loads, lightest: lightestDay(chores, moves, chore, today, today, capacity)?.date ?? null };
}
