import type { LogEntry } from "@/lib/core/types";
import type { Chore, StoredChoreMove } from "@/lib/chores/types";
import {
  addDaysISO, capacityLevel, choresDueOn, choresForDay, completedLoadOn, lightestDay,
  movedFrom, occursOn, outstandingDates, plannedLoadOn, pointsOf, todayLoad,
} from "@/lib/chores/logic";
import CapacityCalendar, { type CapacityDay, type CapacityEntry } from "./capacity-calendar";

/** yyyy-mm-dd for the given year/month(0-based)/day, UTC-safe. */
function iso(y: number, m0: number, d: number): string {
  return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** How far ahead a picked move date can preview its load. */
const LOOKAHEAD_DAYS = 120;

/**
 * Works out every day of `month` ("YYYY-MM") on the server — load, colour level
 * and the chores behind it — and hands the plain data to the client calendar.
 * Past days count what was actually done; today counts everything owed today
 * (overdue + due + done); future days count what's planned (pattern + moves).
 */
export default function CapacityMonth({
  month, today, chores, logs, moves, capacity, prevHref, nextHref,
}: {
  month: string;
  today: string;
  chores: Chore[];
  logs: LogEntry[];
  moves: StoredChoreMove[];
  capacity: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const [y, m] = month.split("-").map(Number);
  const m0 = m - 1;
  const daysInMonth = new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
  const suggest = (c: Chore, from: string) => lightestDay(chores, moves, c, from, today, capacity);
  // Upcoming days each chore already falls on: moving onto one merges, so its load doesn't grow.
  const alreadyOnCache = new Map<string, string[]>();
  const alreadyOn = (c: Chore) => {
    let list = alreadyOnCache.get(c.id);
    if (!list) {
      list = [];
      for (let i = 0; i <= LOOKAHEAD_DAYS; i++) {
        const d = addDaysISO(today, i);
        if (occursOn(c, d, moves)) list.push(d);
      }
      alreadyOnCache.set(c.id, list);
    }
    return list;
  };

  const days: CapacityDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = iso(y, m0, d);
    let load: number;
    let entries: CapacityEntry[];
    if (date < today) {
      // Read-only actuals: the chores marked done that day.
      const ids = new Set(logs.filter((l) => l.done && l.date === date).map((l) => l.itemId));
      load = completedLoadOn(chores, logs, date);
      entries = chores.filter((c) => ids.has(c.id)).sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => ({ choreId: c.id, name: c.name, points: pointsOf(c), done: true, fromDates: [] }));
    } else if (date === today) {
      const day = choresForDay(chores, logs, today, moves);
      load = todayLoad(day).planned;
      entries = [
        ...day.overdue.map(({ chore: c, since }) => ({
          choreId: c.id, name: c.name, points: pointsOf(c), overdueSince: since,
          // Moving an overdue chore moves every outstanding occurrence with it.
          fromDates: outstandingDates(c, logs, today, moves), suggestion: suggest(c, today), alreadyOn: alreadyOn(c),
        })),
        ...day.due.map((c) => ({
          choreId: c.id, name: c.name, points: pointsOf(c), movedFrom: movedFrom(c, today, moves),
          fromDates: [today], suggestion: suggest(c, today), alreadyOn: alreadyOn(c),
        })),
        ...day.done.map(({ chore: c }) => ({
          choreId: c.id, name: c.name, points: pointsOf(c), done: true, fromDates: [],
        })),
      ];
    } else {
      load = plannedLoadOn(chores, date, moves);
      entries = choresDueOn(chores, date, moves).map((c) => ({
        choreId: c.id, name: c.name, points: pointsOf(c), movedFrom: movedFrom(c, date, moves),
        fromDates: [date], suggestion: suggest(c, date), alreadyOn: alreadyOn(c),
      }));
    }
    days.push({ iso: date, day: d, load, level: capacityLevel(load, capacity), entries });
  }

  // Load of every day from today on (independent of the month shown), so the
  // move picker can preview "what that day becomes" for any date it offers.
  const upcoming: Record<string, number> = { [today]: todayLoad(choresForDay(chores, logs, today, moves)).planned };
  for (let i = 1; i <= LOOKAHEAD_DAYS; i++) {
    const date = addDaysISO(today, i);
    upcoming[date] = plannedLoadOn(chores, date, moves);
  }

  const title = new Date(`${month}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  // JS getUTCDay(): 0=Sun..6=Sat → convert to Mon=0..Sun=6 for leading blanks.
  const firstDow = (new Date(Date.UTC(y, m0, 1)).getUTCDay() + 6) % 7;

  return (
    <CapacityCalendar title={title} today={today} capacity={capacity} days={days}
      upcoming={upcoming} leadingBlanks={firstDow} prevHref={prevHref} nextHref={nextHref} />
  );
}
