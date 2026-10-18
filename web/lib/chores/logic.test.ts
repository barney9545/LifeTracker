import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LogEntry } from "../core/types";
import type { Chore, ChoreMove, StoredChoreMove } from "./types";
import { SEED_CHORES, SEED_START } from "./seed";
import {
  CHORE_LOG_DAYS,
  DEFAULT_CAPACITY,
  DEFAULT_POINTS,
  LIGHTEST_DAY_WINDOW,
  WEEK_A_START,
  addDaysISO,
  applyMove,
  capacityLevel,
  choresDueOn,
  choresForDay,
  completedLoadOn,
  describeSchedule,
  isActiveOn,
  isDueOn,
  isMonthWeek,
  isScheduledOn,
  lightestDay,
  movedFrom,
  occursOn,
  outstandingDates,
  outstandingSince,
  plannedLoadOn,
  scheduleStart,
  todayLoad,
  weekOf,
  weekdayOf,
} from "./logic";

/* ---- helpers ---- */

function chore(over: Partial<Chore> = {}): Chore {
  return {
    id: "c1", name: "Chore", days: [1], frequency: "weekly", week: "A", monthWeek: 1, points: 10,
    active: true, notes: "", addedDate: SEED_START, ...over,
  };
}

let logSeq = 0;
function done(choreId: string, date: string, over: Partial<LogEntry> = {}): LogEntry {
  logSeq += 1;
  return { id: `log${logSeq}`, itemId: choreId, itemName: "", date, done: true, time: "", notes: "", ...over };
}

/** The seeded list as the repository creates it (id = position, start = SEED_START). */
const seed: Chore[] = SEED_CHORES.map((c, i) => ({ ...c, id: String(i + 1), addedDate: SEED_START }));
const byName = (name: string) => seed.find((c) => c.name === name)!;
const LAUNDRY = byName("Laundry");
const BOTTLE = byName("Wash bottle");
const NAILS = byName("Trim nails");
const BEARD = byName("Clean beard");
const SHEETS = byName("Change bed sheets & pillow covers");
const NOSE = byName("Trim nose hair");

const names = (cs: Chore[]) => cs.map((c) => c.name);

/** Logs marking every seeded chore done on every day it was scheduled in [from, to]. */
function allDone(from: string, to: string, except: Chore[] = []): LogEntry[] {
  const logs: LogEntry[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    for (const c of choresDueOn(seed, d)) if (!except.includes(c)) logs.push(done(c.id, d));
  }
  return logs;
}

/* ---- date basics ---- */

describe("addDaysISO", () => {
  it("shifts forwards and backwards", () => {
    assert.equal(addDaysISO("2026-10-19", 1), "2026-10-20");
    assert.equal(addDaysISO("2026-10-19", -7), "2026-10-12");
    assert.equal(addDaysISO("2026-10-19", 0), "2026-10-19");
  });
  it("crosses month, year and leap-day boundaries", () => {
    assert.equal(addDaysISO("2026-10-31", 1), "2026-11-01");
    assert.equal(addDaysISO("2026-12-31", 1), "2027-01-01");
    assert.equal(addDaysISO("2027-01-01", -1), "2026-12-31");
    assert.equal(addDaysISO("2028-02-28", 1), "2028-02-29");
  });
  it("ignores a trailing time component", () => {
    assert.equal(addDaysISO("2026-10-19T23:30:00", 1), "2026-10-20");
  });
});

describe("weekdayOf", () => {
  it("returns ISO weekdays, 1 = Mon … 7 = Sun", () => {
    assert.equal(weekdayOf("2026-10-19"), 1);
    assert.equal(weekdayOf("2026-10-22"), 4);
    assert.equal(weekdayOf("2026-10-23"), 5);
    assert.equal(weekdayOf("2026-10-24"), 6);
    assert.equal(weekdayOf("2026-10-25"), 7);
    assert.equal(weekdayOf("2027-01-01"), 5);
    assert.equal(weekdayOf("2028-02-29"), 2);
  });
});

describe("weekOf", () => {
  it("anchors week A on WEEK_A_START", () => {
    assert.equal(WEEK_A_START, "2026-10-19");
    assert.equal(weekdayOf(WEEK_A_START), 1);
    assert.equal(weekOf(WEEK_A_START), "A");
  });
  it("keeps the whole Mon–Sun week together", () => {
    for (let d = "2026-10-19"; d <= "2026-10-25"; d = addDaysISO(d, 1)) assert.equal(weekOf(d), "A", d);
    for (let d = "2026-10-26"; d <= "2026-11-01"; d = addDaysISO(d, 1)) assert.equal(weekOf(d), "B", d);
  });
  it("alternates forwards", () => {
    assert.equal(weekOf("2026-10-26"), "B");
    assert.equal(weekOf("2026-11-02"), "A");
    assert.equal(weekOf("2026-11-09"), "B");
    assert.equal(weekOf("2026-11-16"), "A");
  });
  it("alternates backwards before the anchor", () => {
    assert.equal(weekOf("2026-10-12"), "B");
    assert.equal(weekOf("2026-10-18"), "B"); // Sunday right before the anchor
    assert.equal(weekOf("2026-10-14"), "B");
    assert.equal(weekOf("2026-10-05"), "A");
    assert.equal(weekOf("2026-09-28"), "B");
  });
  it("crosses month and year boundaries", () => {
    assert.equal(weekOf("2026-10-31"), "B"); // Sat, week of 26 Oct
    assert.equal(weekOf("2026-11-01"), "B"); // Sun, same week
    assert.equal(weekOf("2026-12-28"), "A"); // 10 weeks after the anchor
    assert.equal(weekOf("2027-01-01"), "A"); // Fri in that same week
    assert.equal(weekOf("2027-01-03"), "A"); // Sun in that same week
    assert.equal(weekOf("2027-01-04"), "B");
  });
});

/* ---- pattern matching ---- */

describe("isScheduledOn", () => {
  it("weekly chores land on their days only", () => {
    const c = chore({ days: [2] });
    assert.equal(isScheduledOn(c, "2026-10-20"), true);
    assert.equal(isScheduledOn(c, "2026-10-27"), true);
    for (const d of ["2026-10-19", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]) {
      assert.equal(isScheduledOn(c, d), false, d);
    }
  });
  it("multi-day chores (Mon + Thu) land on each day, every week", () => {
    const hits: string[] = [];
    for (let d = "2026-10-19"; d <= "2026-11-01"; d = addDaysISO(d, 1)) if (isScheduledOn(LAUNDRY, d)) hits.push(d);
    assert.deepEqual(hits, ["2026-10-19", "2026-10-22", "2026-10-26", "2026-10-29"]);
  });
  it("two-week chores alternate A/B over several weeks", () => {
    const wednesdays = ["2026-10-21", "2026-10-28", "2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25"];
    assert.deepEqual(wednesdays.filter((d) => isScheduledOn(SHEETS, d)), ["2026-10-21", "2026-11-04", "2026-11-18"]);
    assert.deepEqual(wednesdays.filter((d) => isScheduledOn(NOSE, d)), ["2026-10-28", "2026-11-11", "2026-11-25"]);
  });
  it("ignores active flag and start date (pattern only)", () => {
    const paused = chore({ days: [3], frequency: "biweekly", week: "B", active: false, addedDate: "2027-01-01" });
    assert.equal(isScheduledOn(paused, "2026-10-14"), true);
  });
});

/* ---- the seeded schedule ---- */

describe("seeded schedule", () => {
  const expected: Record<string, string[]> = {
    "2026-10-19": ["Laundry", "Wash bottle"],
    "2026-10-20": ["Clean beard", "Trim nails"],
    "2026-10-21": ["Change bed sheets & pillow covers"],
    "2026-10-22": ["Laundry", "Wash bottle"],
    "2026-10-23": [],
    "2026-10-24": [],
    "2026-10-25": [],
    "2026-10-26": ["Laundry", "Wash bottle"],
    "2026-10-27": ["Clean beard", "Trim nails"],
    "2026-10-28": ["Trim nose hair"],
    "2026-10-29": ["Laundry", "Wash bottle"],
    "2026-10-30": [],
    "2026-10-31": [],
    "2026-11-01": [],
  };
  for (const [date, want] of Object.entries(expected)) {
    it(`${date} (${weekdayOf(date)}) → ${want.join(", ") || "nothing"}`, () => {
      assert.deepEqual(names(choresDueOn(seed, date)), want);
    });
  }
  it("starts on WEEK_A_START so nothing earlier is due", () => {
    assert.equal(SEED_START, WEEK_A_START);
    for (let d = "2026-10-05"; d <= "2026-10-18"; d = addDaysISO(d, 1)) assert.deepEqual(choresDueOn(seed, d), [], d);
  });
  it("nothing is outstanding on day one before anything is scheduled", () => {
    const day = choresForDay(seed, [], "2026-10-19");
    assert.deepEqual(names(day.due), ["Laundry", "Wash bottle"]);
    assert.deepEqual(day.overdue, []);
    assert.deepEqual(day.done, []);
  });
});

/* ---- overdue carry-over ---- */

describe("outstandingSince", () => {
  it("is null once caught up, and today's date when due today", () => {
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-19"), "2026-10-19");
    assert.equal(outstandingSince(LAUNDRY, [done(LAUNDRY.id, "2026-10-19")], "2026-10-19"), null);
    assert.equal(outstandingSince(LAUNDRY, [done(LAUNDRY.id, "2026-10-19")], "2026-10-21"), null);
  });
  it("a missed day stays outstanding until done", () => {
    for (const d of ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-26", "2026-11-10"]) {
      assert.equal(outstandingSince(LAUNDRY, [], d), "2026-10-19", d);
    }
  });
  it("one completion clears every outstanding occurrence up to that day", () => {
    const logs = [done(LAUNDRY.id, "2026-10-22")]; // Mon missed, done Thu
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-22"), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-25"), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-26"), "2026-10-26");
  });
  it("a late completion covers earlier days without shifting the schedule", () => {
    const logs = [done(LAUNDRY.id, "2026-10-23")]; // Thu's laundry done Fri
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-25"), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-26"), "2026-10-26"); // still Mon, not Fri+3
    const sheets = [done(SHEETS.id, "2026-10-23")]; // Wed's sheets done Fri
    assert.equal(outstandingSince(SHEETS, sheets, "2026-11-03"), null);
    assert.equal(outstandingSince(SHEETS, sheets, "2026-11-04"), "2026-11-04");
  });
  it("two-week chores carry over across their off week", () => {
    assert.equal(outstandingSince(SHEETS, [], "2026-10-28"), "2026-10-21");
    assert.equal(outstandingSince(SHEETS, [], "2026-11-04"), "2026-10-21");
    assert.equal(outstandingSince(SHEETS, [done(SHEETS.id, "2026-11-04")], "2026-11-04"), null);
    assert.equal(outstandingSince(NOSE, [], "2026-10-27"), null); // first B Wednesday not reached yet
    assert.equal(outstandingSince(NOSE, [], "2026-10-29"), "2026-10-28");
  });
  it("uses the latest completion on or before the date, whatever the log order", () => {
    const logs = [done(LAUNDRY.id, "2026-10-26"), done(LAUNDRY.id, "2026-10-19")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-28"), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-22"), "2026-10-22"); // the 26th is in the future here
  });
});

describe("no early credit", () => {
  it("done Wednesday does not cover Thursday", () => {
    const logs = [done(LAUNDRY.id, "2026-10-19"), done(LAUNDRY.id, "2026-10-21")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-21"), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-22"), "2026-10-22");
    const day = choresForDay([LAUNDRY], logs, "2026-10-22");
    assert.deepEqual(names(day.due), ["Laundry"]);
  });
  it("done Wednesday after a missed Monday covers Monday but still not Thursday", () => {
    const logs = [done(LAUNDRY.id, "2026-10-21")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-21"), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-22"), "2026-10-22");
  });
  it("done before the first scheduled day does not cover it", () => {
    const logs = [done(NOSE.id, "2026-10-21")];
    assert.equal(outstandingSince(NOSE, logs, "2026-10-28"), "2026-10-28");
  });
});

describe("choresForDay", () => {
  it("buckets a Thursday with nothing ever done", () => {
    const day = choresForDay(seed, [], "2026-10-22");
    assert.deepEqual(
      day.overdue.map((o) => [o.chore.name, o.since]),
      [
        ["Laundry", "2026-10-19"],
        ["Wash bottle", "2026-10-19"],
        ["Clean beard", "2026-10-20"],
        ["Trim nails", "2026-10-20"],
        ["Change bed sheets & pillow covers", "2026-10-21"],
      ],
    );
    assert.deepEqual(day.due, []); // Laundry/Wash bottle appear once, as overdue
    assert.deepEqual(day.done, []);
  });
  it("lists a chore missed on several days exactly once", () => {
    const day = choresForDay([LAUNDRY], [], "2026-10-29"); // missed 19, 22, 26 and due 29
    assert.equal(day.overdue.length, 1);
    assert.deepEqual(day.overdue[0], { chore: LAUNDRY, since: "2026-10-19" });
    assert.deepEqual(day.due, []);
  });
  it("splits overdue / due / done, sorted", () => {
    const l1 = done(LAUNDRY.id, "2026-10-22");
    const l2 = done(LAUNDRY.id, "2026-10-22");
    const logs = [done(BOTTLE.id, "2026-10-19"), l1, l2];
    const day = choresForDay(seed, logs, "2026-10-22");
    assert.deepEqual(day.done, [{ chore: LAUNDRY, logId: l2.id }]); // latest completion, for undo
    assert.deepEqual(names(day.due), ["Wash bottle"]);
    assert.deepEqual(names(day.overdue.map((o) => o.chore)), ["Clean beard", "Trim nails", "Change bed sheets & pillow covers"]);
  });
  it("sorts due and done by name", () => {
    const logs = [done(NAILS.id, "2026-10-20"), done(BEARD.id, "2026-10-20")];
    assert.deepEqual(names(choresForDay(seed, logs, "2026-10-20").done.map((d) => d.chore)), ["Clean beard", "Trim nails"]);
    assert.deepEqual(names(choresForDay([NAILS, BEARD], [], "2026-10-20").due), ["Clean beard", "Trim nails"]);
  });
  it("shows a chore done today in done even on an unscheduled day", () => {
    const log = done(LAUNDRY.id, "2026-10-23"); // Thursday's laundry, done Friday
    const day = choresForDay([LAUNDRY], [log], "2026-10-23");
    assert.deepEqual(day.done, [{ chore: LAUNDRY, logId: log.id }]);
    assert.deepEqual(day.overdue, []);
  });
  it("is all clear the day after everything was done", () => {
    const day = choresForDay(seed, allDone("2026-10-19", "2026-10-22"), "2026-10-23");
    assert.deepEqual(day, { overdue: [], due: [], done: [] });
  });
  it("does not mutate the input list", () => {
    const list = [NOSE, BEARD, LAUNDRY];
    choresForDay(list, [], "2026-10-22");
    assert.deepEqual(names(list), ["Trim nose hair", "Clean beard", "Laundry"]);
  });
});

describe("weekends", () => {
  const logs = allDone("2026-10-19", "2026-10-22", [LAUNDRY]).concat(done(LAUNDRY.id, "2026-10-19"));
  it("a Thursday miss is overdue on Fri, Sat and Sun", () => {
    for (const d of ["2026-10-23", "2026-10-24", "2026-10-25"]) {
      const day = choresForDay(seed, logs, d);
      assert.deepEqual(day.overdue, [{ chore: LAUNDRY, since: "2026-10-22" }], d);
      assert.deepEqual(day.due, [], d);
    }
  });
  it("nothing new is due on Sat/Sun", () => {
    for (const d of ["2026-10-24", "2026-10-25", "2026-10-31", "2026-11-01"]) assert.deepEqual(choresDueOn(seed, d), [], d);
    assert.deepEqual(choresForDay(seed, allDone("2026-10-19", "2026-10-25"), "2026-10-24"), { overdue: [], due: [], done: [] });
  });
  it("the miss carries into Monday as a single overdue entry", () => {
    const day = choresForDay(seed, logs, "2026-10-26");
    assert.deepEqual(day.overdue, [{ chore: LAUNDRY, since: "2026-10-22" }]);
    assert.deepEqual(names(day.due), ["Wash bottle"]);
  });
});

/* ---- start dates, pause & resume ---- */

describe("scheduleStart", () => {
  it("is the latest of added / resumed / resumeOn", () => {
    assert.equal(scheduleStart(chore({ addedDate: "2026-10-01" })), "2026-10-01");
    assert.equal(scheduleStart(chore({ addedDate: "2026-10-01", resumedDate: "2026-10-21" })), "2026-10-21");
    assert.equal(scheduleStart(chore({ addedDate: "2026-10-01", resumedDate: "2026-10-21", resumeOn: "2026-10-29" })), "2026-10-29");
    assert.equal(scheduleStart(chore({ addedDate: "2026-10-25", resumedDate: "2026-10-21" })), "2026-10-25");
  });
  it("ignores blank / malformed dates and falls back when none are set", () => {
    assert.equal(scheduleStart(chore({ addedDate: "2026-10-01", resumedDate: "", resumeOn: "" })), "2026-10-01");
    assert.equal(scheduleStart(chore({ addedDate: "2026-10-01", resumeOn: "soon" })), "2026-10-01");
    assert.equal(scheduleStart(chore({ addedDate: "" })), "0000-01-01");
  });
});

describe("start-date rules", () => {
  it("a chore added mid-week is first due on its next scheduled day", () => {
    const c = chore({ days: [1, 4], addedDate: "2026-10-21" }); // added Wed
    assert.equal(isDueOn(c, "2026-10-19"), false);
    assert.equal(outstandingSince(c, [], "2026-10-21"), null);
    assert.equal(outstandingSince(c, [], "2026-10-22"), "2026-10-22");
    assert.deepEqual(choresForDay([c], [], "2026-10-21"), { overdue: [], due: [], done: [] });
  });
  it("nothing before addedDate is ever overdue", () => {
    const c = chore({ days: [1, 2, 3, 4, 5], addedDate: "2026-10-23" });
    assert.equal(outstandingSince(c, [], "2026-10-23"), "2026-10-23");
    assert.equal(outstandingSince(c, [], "2026-10-25"), "2026-10-23");
    assert.equal(outstandingSince(c, [], "2026-10-22"), null); // asOf before it existed
  });
  it("resumedDate resets the overdue window", () => {
    const c = chore({ days: [1, 4], addedDate: "2026-09-01", resumedDate: "2026-10-21" });
    assert.equal(outstandingSince(c, [], "2026-10-21"), null);
    assert.equal(outstandingSince(c, [], "2026-10-22"), "2026-10-22");
  });
  it("paused chores are never due or overdue", () => {
    const c = chore({ days: [1, 4], active: false, addedDate: "2026-09-01" });
    assert.equal(isActiveOn(c, "2026-10-22"), false);
    assert.equal(isDueOn(c, "2026-10-22"), false);
    assert.equal(outstandingSince(c, [], "2026-10-22"), null);
    assert.deepEqual(choresDueOn([c], "2026-10-22"), []);
    assert.deepEqual(choresForDay([c], [], "2026-10-22"), { overdue: [], due: [], done: [] });
  });
  it("a paused chore never shows in done either, even if logged today", () => {
    const c = chore({ days: [4], active: false });
    assert.deepEqual(choresForDay([c], [done(c.id, "2026-10-22")], "2026-10-22"), { overdue: [], due: [], done: [] });
  });
  describe("scheduled resume (resumeOn)", () => {
    const c = chore({ days: [1, 4], active: false, addedDate: "2026-09-01", resumeOn: "2026-10-29" });
    it("stays paused before the date", () => {
      for (const d of ["2026-10-22", "2026-10-26", "2026-10-28"]) {
        assert.equal(isActiveOn(c, d), false, d);
        assert.equal(outstandingSince(c, [], d), null, d);
        assert.deepEqual(choresDueOn([c], d), [], d);
      }
    });
    it("is active and due on the date when scheduled that day", () => {
      assert.equal(isActiveOn(c, "2026-10-29"), true);
      assert.equal(isDueOn(c, "2026-10-29"), true);
      assert.deepEqual(names(choresForDay([c], [], "2026-10-29").due), ["Chore"]);
    });
    it("occurrences during the pause never become overdue", () => {
      assert.equal(outstandingSince(c, [], "2026-10-29"), "2026-10-29"); // not Mon 26 or earlier
      assert.equal(outstandingSince(c, [], "2026-10-30"), "2026-10-29");
    });
    it("a resume date on an unscheduled day waits for the next scheduled day", () => {
      const sat = { ...c, resumeOn: "2026-10-24" };
      assert.equal(isActiveOn(sat, "2026-10-24"), true);
      assert.equal(outstandingSince(sat, [], "2026-10-25"), null);
      assert.equal(outstandingSince(sat, [], "2026-10-26"), "2026-10-26");
    });
  });
});

/* ---- log filtering & lookback ---- */

describe("log matching", () => {
  it("ignores logs for other chores", () => {
    const logs = [done(BOTTLE.id, "2026-10-19"), done("999", "2026-10-19")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-20"), "2026-10-19");
    assert.deepEqual(names(choresForDay([LAUNDRY], logs, "2026-10-19").due), ["Laundry"]);
  });
  it("ignores done:false entries", () => {
    const logs = [done(LAUNDRY.id, "2026-10-19", { done: false })];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-19"), "2026-10-19");
    assert.deepEqual(choresForDay([LAUNDRY], logs, "2026-10-19").done, []);
  });
  it("matches by id, not name", () => {
    const logs = [done("other", "2026-10-19", { itemName: "Laundry" })];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-19"), "2026-10-19");
  });
});

describe("CHORE_LOG_DAYS lookback", () => {
  it("caps how far back a very old start can be overdue", () => {
    const c = chore({ days: [1, 4], addedDate: "2000-01-03" });
    const asOf = "2026-10-22";
    const since = outstandingSince(c, [], asOf);
    assert.ok(since !== null);
    assert.ok(since >= addDaysISO(asOf, -CHORE_LOG_DAYS), since);
    assert.ok(isScheduledOn(c, since));
  });
  it("handles a missing addedDate (legacy) without crashing", () => {
    const c = chore({ days: [3], frequency: "biweekly", week: "B", addedDate: "" });
    const since = outstandingSince(c, [], "2026-10-29");
    assert.ok(since !== null && since >= addDaysISO("2026-10-29", -CHORE_LOG_DAYS));
    assert.ok(isScheduledOn(c, since));
  });
  it("a completion older than the window still leaves recent misses outstanding", () => {
    const c = chore({ days: [1], addedDate: "2026-01-05" });
    const since = outstandingSince(c, [done(c.id, "2026-01-05")], "2026-10-22");
    assert.ok(since !== null && since >= addDaysISO("2026-10-22", -CHORE_LOG_DAYS));
  });
  it("stays cheap for a long list over a long range", () => {
    const old = seed.map((c) => ({ ...c, addedDate: "1990-01-01" }));
    const t = Date.now();
    for (let d = "2026-10-19"; d <= "2027-10-19"; d = addDaysISO(d, 7)) choresForDay(old, [], d);
    assert.ok(Date.now() - t < 2000);
  });
});

/* ---- labels ---- */

describe("describeSchedule", () => {
  it("formats weekly and two-week schedules", () => {
    assert.equal(describeSchedule(LAUNDRY), "Mon, Thu · weekly");
    assert.equal(describeSchedule(NAILS), "Tue · weekly");
    assert.equal(describeSchedule(SHEETS), "Wed · every 2 weeks (A)");
    assert.equal(describeSchedule(NOSE), "Wed · every 2 weeks (B)");
    assert.equal(describeSchedule(chore({ days: [1, 2, 3, 4, 5] })), "Mon, Tue, Wed, Thu, Fri · weekly");
  });
  it("handles no days", () => {
    assert.equal(describeSchedule(chore({ days: [] })), "No days · weekly");
  });
});

describe("monthly", () => {
  const FIRST_MON = chore({ frequency: "monthly", monthWeek: 1, days: [1] });
  const LAST_FRI = chore({ frequency: "monthly", monthWeek: -1, days: [5] });

  it("isMonthWeek: Nth and last occurrence of a weekday", () => {
    assert.equal(isMonthWeek("2026-11-02", 1), true); // Nov Mondays: 2, 9, 16, 23, 30
    assert.equal(isMonthWeek("2026-11-09", 2), true);
    assert.equal(isMonthWeek("2026-11-23", 4), true);
    assert.equal(isMonthWeek("2026-11-23", -1), false); // a 5th Monday follows
    assert.equal(isMonthWeek("2026-11-30", -1), true);
    assert.equal(isMonthWeek("2026-11-30", 4), false);
    assert.equal(isMonthWeek("2026-10-26", 4), true); // Oct: 4th Monday is also the last
    assert.equal(isMonthWeek("2026-10-26", -1), true);
  });

  it("1st Monday lands only on the first Monday of each month", () => {
    assert.deepEqual(
      ["2026-11-02", "2026-11-09", "2026-12-07", "2027-01-04", "2027-01-05"].map((d) => isScheduledOn(FIRST_MON, d)),
      [true, false, true, true, false],
    );
  });

  it("last Friday, across a year boundary", () => {
    for (const d of ["2026-10-30", "2026-11-27", "2026-12-25", "2027-01-29"]) assert.equal(isScheduledOn(LAST_FRI, d), true, d);
    for (const d of ["2026-10-23", "2026-12-18", "2027-01-22"]) assert.equal(isScheduledOn(LAST_FRI, d), false, d);
  });

  it("a missed monthly chore stays overdue until done, then waits for next month", () => {
    assert.equal(outstandingSince(FIRST_MON, [], "2026-11-10"), "2026-11-02");
    const logs = [done("c1", "2026-11-10")];
    assert.equal(outstandingSince(FIRST_MON, logs, "2026-11-10"), null);
    assert.equal(outstandingSince(FIRST_MON, logs, "2026-12-06"), null);
    assert.equal(outstandingSince(FIRST_MON, logs, "2026-12-07"), "2026-12-07");
  });

  it("describeSchedule", () => {
    assert.equal(describeSchedule(FIRST_MON), "1st Mon · monthly");
    assert.equal(describeSchedule(LAST_FRI), "Last Fri · monthly");
  });
});

describe("weekend days", () => {
  it("a Saturday chore is due on Saturdays", () => {
    const SAT = chore({ days: [6] });
    assert.equal(isDueOn(SAT, "2026-10-24"), true);
    assert.equal(isDueOn(SAT, "2026-10-25"), false);
    assert.equal(describeSchedule(SAT), "Sat · weekly");
  });
});

/* ---- one-off moves ---- */

/** A stored move for one chore. */
const mv = (c: Chore, fromDate: string, toDate: string): StoredChoreMove => ({ choreId: c.id, fromDate, toDate });
/** Every day in [from, to] the chore occurs on. */
function occurrences(c: Chore, from: string, to: string, moves: StoredChoreMove[] = []): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) if (occursOn(c, d, moves)) out.push(d);
  return out;
}
/** Stored moves for a chore from a plain move list (what the repository round-trips). */
const stored = (c: Chore, ms: ChoreMove[]): StoredChoreMove[] => ms.map((m) => ({ choreId: c.id, ...m }));

describe("occursOn / movedFrom", () => {
  it("without moves it is exactly the pattern", () => {
    for (let d = "2026-10-12"; d <= "2026-11-08"; d = addDaysISO(d, 1)) {
      assert.equal(occursOn(LAUNDRY, d), isScheduledOn(LAUNDRY, d), d);
      assert.equal(occursOn(LAUNDRY, d, []), isScheduledOn(LAUNDRY, d), d);
      assert.equal(movedFrom(LAUNDRY, d), null, d);
    }
  });
  it("a moved occurrence leaves its pattern day and lands on the target", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")]; // Thu → Fri
    assert.deepEqual(occurrences(LAUNDRY, "2026-10-19", "2026-11-01", moves), ["2026-10-19", "2026-10-23", "2026-10-26", "2026-10-29"]);
    assert.equal(movedFrom(LAUNDRY, "2026-10-23", moves), "2026-10-22");
    assert.equal(movedFrom(LAUNDRY, "2026-10-22", moves), null); // moved away, not moved in
    assert.equal(movedFrom(LAUNDRY, "2026-10-19", moves), null); // untouched pattern day
  });
  it("only touches that one occurrence — the repeating pattern is unchanged", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")];
    assert.equal(occursOn(LAUNDRY, "2026-10-29", moves), true);
    assert.equal(occursOn(LAUNDRY, "2026-10-30", moves), false);
    assert.equal(isScheduledOn(LAUNDRY, "2026-10-22"), true); // pattern check ignores moves
  });
  it("can move onto a weekend day", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-24")];
    assert.equal(occursOn(LAUNDRY, "2026-10-24", moves), true);
    assert.equal(movedFrom(LAUNDRY, "2026-10-24", moves), "2026-10-22");
  });
  it("moving onto a day it already occurs merges into one occurrence", () => {
    const moves = [mv(LAUNDRY, "2026-10-19", "2026-10-22")]; // Mon → Thu (already a Laundry day)
    assert.equal(occursOn(LAUNDRY, "2026-10-19", moves), false);
    assert.equal(occursOn(LAUNDRY, "2026-10-22", moves), true);
    assert.equal(movedFrom(LAUNDRY, "2026-10-22", moves), "2026-10-19");
  });
  it("ignores moves belonging to other chores", () => {
    const moves = [mv(BOTTLE, "2026-10-22", "2026-10-23")];
    assert.equal(occursOn(LAUNDRY, "2026-10-22", moves), true);
    assert.equal(occursOn(LAUNDRY, "2026-10-23", moves), false);
    assert.equal(movedFrom(LAUNDRY, "2026-10-23", moves), null);
    assert.equal(occursOn(BOTTLE, "2026-10-22", moves), false);
    assert.equal(occursOn(BOTTLE, "2026-10-23", moves), true);
  });
  it("works for two-week and monthly chores", () => {
    const FIRST_MON = chore({ id: "m", frequency: "monthly", monthWeek: 1, days: [1] });
    const moves = [mv(SHEETS, "2026-10-21", "2026-10-28"), mv(FIRST_MON, "2026-11-02", "2026-11-03")];
    assert.equal(occursOn(SHEETS, "2026-10-21", moves), false);
    assert.equal(occursOn(SHEETS, "2026-10-28", moves), true); // a B week, off-pattern for SHEETS
    assert.equal(occursOn(SHEETS, "2026-11-04", moves), true);
    assert.equal(occursOn(FIRST_MON, "2026-11-02", moves), false);
    assert.equal(occursOn(FIRST_MON, "2026-11-03", moves), true);
    assert.equal(occursOn(FIRST_MON, "2026-12-07", moves), true);
  });
  it("is pattern-level: ignores active flag and start date", () => {
    const paused = chore({ days: [1], active: false });
    const moves = [mv(paused, "2026-10-19", "2026-10-20")];
    assert.equal(occursOn(paused, "2026-10-20", moves), true);
    assert.equal(isDueOn(paused, "2026-10-20", moves), false);
  });
});

describe("isDueOn / choresDueOn with moves", () => {
  it("a moved chore is due on the target day, not the original", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")];
    assert.equal(isDueOn(LAUNDRY, "2026-10-22", moves), false);
    assert.equal(isDueOn(LAUNDRY, "2026-10-23", moves), true);
    assert.deepEqual(names(choresDueOn(seed, "2026-10-22", moves)), ["Wash bottle"]);
    assert.deepEqual(names(choresDueOn(seed, "2026-10-23", moves)), ["Laundry"]);
  });
  it("keeps name order when a chore is moved in", () => {
    const moves = [mv(NOSE, "2026-10-28", "2026-10-20")];
    assert.deepEqual(names(choresDueOn(seed, "2026-10-20", moves)), ["Clean beard", "Trim nails", "Trim nose hair"]);
    assert.deepEqual(choresDueOn(seed, "2026-10-28", moves), []);
  });
  it("a merged day lists the chore once", () => {
    const moves = [mv(LAUNDRY, "2026-10-19", "2026-10-22")];
    assert.deepEqual(names(choresDueOn(seed, "2026-10-22", moves)), ["Laundry", "Wash bottle"]);
  });
  it("still respects pause and start date on the target day", () => {
    const paused = chore({ days: [1], active: false, addedDate: "2026-09-01" });
    assert.deepEqual(choresDueOn([paused], "2026-10-20", [mv(paused, "2026-10-19", "2026-10-20")]), []);
    const late = chore({ days: [4], addedDate: "2026-10-21" });
    assert.equal(isDueOn(late, "2026-10-20", [mv(late, "2026-10-22", "2026-10-20")]), false); // before it existed
  });
  it("the default (no moves) is unchanged", () => {
    assert.deepEqual(names(choresDueOn(seed, "2026-10-22")), names(choresDueOn(seed, "2026-10-22", [])));
  });
});

describe("outstandingDates", () => {
  it("lists every missed occurrence, oldest first, including today", () => {
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-29"), ["2026-10-19", "2026-10-22", "2026-10-26", "2026-10-29"]);
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-28"), ["2026-10-19", "2026-10-22", "2026-10-26"]);
  });
  it("a completion clears everything up to its day", () => {
    assert.deepEqual(outstandingDates(LAUNDRY, [done(LAUNDRY.id, "2026-10-22")], "2026-10-29"), ["2026-10-26", "2026-10-29"]);
    assert.deepEqual(outstandingDates(LAUNDRY, [done(LAUNDRY.id, "2026-10-29")], "2026-10-29"), []);
  });
  it("is empty for paused chores and before the start date", () => {
    assert.deepEqual(outstandingDates(chore({ days: [1], active: false }), [], "2026-10-29"), []);
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-18"), []);
  });
  it("its first entry is outstandingSince", () => {
    for (const asOf of ["2026-10-18", "2026-10-19", "2026-10-25", "2026-11-05"]) {
      assert.equal(outstandingSince(LAUNDRY, [], asOf), outstandingDates(LAUNDRY, [], asOf)[0] ?? null, asOf);
    }
  });
  it("follows moves: a moved-away day drops out, a moved-in past day joins", () => {
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-22", [mv(LAUNDRY, "2026-10-19", "2026-10-21")]), ["2026-10-21", "2026-10-22"]);
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-22", [mv(LAUNDRY, "2026-10-19", "2026-10-24")]), ["2026-10-22"]);
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-24", [mv(LAUNDRY, "2026-10-19", "2026-10-24")]), ["2026-10-22", "2026-10-24"]);
  });
  it("a merged day counts once", () => {
    assert.deepEqual(outstandingDates(LAUNDRY, [], "2026-10-23", [mv(LAUNDRY, "2026-10-19", "2026-10-22")]), ["2026-10-22"]);
  });
});

describe("outstandingSince with moves", () => {
  it("a past occurrence moved away is not overdue; it's due on the new day", () => {
    const moves = [mv(LAUNDRY, "2026-10-19", "2026-10-23")]; // Mon → Fri
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-19", moves), null);
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-21", moves), null);
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-22", moves), "2026-10-22"); // Thu still on pattern
    const logs = [done(LAUNDRY.id, "2026-10-22")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-22", moves), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-23", moves), "2026-10-23");
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-25", moves), "2026-10-23"); // missed Fri → overdue
  });
  it("a future occurrence moved earlier becomes due that day, and is gone from its old day", () => {
    const moves = [mv(LAUNDRY, "2026-10-26", "2026-10-23")]; // next Mon → this Fri
    const logs = [done(LAUNDRY.id, "2026-10-22")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-23", moves), "2026-10-23");
    const after = [...logs, done(LAUNDRY.id, "2026-10-23")];
    assert.equal(outstandingSince(LAUNDRY, after, "2026-10-26", moves), null);
    assert.equal(outstandingSince(LAUNDRY, after, "2026-10-29", moves), "2026-10-29");
  });
  it("moving an overdue chore (all outstanding dates) to a future day clears overdue until then", () => {
    const asOf = "2026-10-23"; // Fri, Laundry missed Mon + Thu
    const pending = outstandingDates(LAUNDRY, [], asOf);
    assert.deepEqual(pending, ["2026-10-19", "2026-10-22"]);
    const moves = stored(LAUNDRY, applyMove([], pending, "2026-10-24"));
    assert.equal(outstandingSince(LAUNDRY, [], asOf, moves), null);
    assert.deepEqual(outstandingDates(LAUNDRY, [], asOf, moves), []);
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-24", moves), "2026-10-24"); // due Sat
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-25", moves), "2026-10-24"); // overdue again if missed
    assert.equal(outstandingSince(LAUNDRY, [done(LAUNDRY.id, "2026-10-24")], "2026-10-26", moves), "2026-10-26");
  });
  it("moving only the oldest outstanding date leaves the later one outstanding", () => {
    const moves = [mv(LAUNDRY, "2026-10-19", "2026-10-24")];
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-23", moves), "2026-10-22");
  });
  it("a completion before a moved-in day doesn't cover it (no early credit)", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")];
    const logs = [done(LAUNDRY.id, "2026-10-21")];
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-22", moves), null);
    assert.equal(outstandingSince(LAUNDRY, logs, "2026-10-23", moves), "2026-10-23");
  });
});

describe("choresForDay with moves", () => {
  const caughtUp = [done(LAUNDRY.id, "2026-10-19"), done(BOTTLE.id, "2026-10-19")];
  it("a chore moved off today isn't due today; it's due on the target day", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")];
    assert.deepEqual(names(choresForDay([LAUNDRY, BOTTLE], caughtUp, "2026-10-22", moves).due), ["Wash bottle"]);
    const fri = choresForDay([LAUNDRY, BOTTLE], [...caughtUp, done(BOTTLE.id, "2026-10-22")], "2026-10-23", moves);
    assert.deepEqual(fri, { overdue: [], due: [LAUNDRY], done: [] });
  });
  it("a chore pulled forward from a later day is due today", () => {
    const moves = [mv(NOSE, "2026-10-28", "2026-10-23")];
    assert.deepEqual(names(choresForDay([NOSE], [], "2026-10-23", moves).due), ["Trim nose hair"]);
    assert.deepEqual(choresForDay([NOSE], [done(NOSE.id, "2026-10-23")], "2026-10-28", moves), { overdue: [], due: [], done: [] });
  });
  it("an overdue chore rescheduled to a future day leaves the overdue list", () => {
    const before = choresForDay(seed, [], "2026-10-22");
    assert.ok(before.overdue.some((o) => o.chore === LAUNDRY));
    const moves = stored(LAUNDRY, applyMove([], outstandingDates(LAUNDRY, [], "2026-10-22"), "2026-10-24"));
    const day = choresForDay(seed, [], "2026-10-22", moves);
    assert.ok(!day.overdue.some((o) => o.chore === LAUNDRY));
    assert.ok(!day.due.includes(LAUNDRY));
    assert.equal(day.overdue.length, before.overdue.length - 1);
    assert.deepEqual(choresForDay([LAUNDRY], [], "2026-10-24", moves), { overdue: [], due: [LAUNDRY], done: [] });
  });
  it("a chore done today stays in done whatever its moves", () => {
    const log = done(LAUNDRY.id, "2026-10-22");
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")];
    assert.deepEqual(choresForDay([LAUNDRY], [...caughtUp, log], "2026-10-22", moves).done, [{ chore: LAUNDRY, logId: log.id }]);
  });
});

describe("applyMove", () => {
  it("simple move adds one entry", () => {
    assert.deepEqual(applyMove([], ["2026-10-19"], "2026-10-21"), [{ fromDate: "2026-10-19", toDate: "2026-10-21" }]);
  });
  it("keeps unrelated moves", () => {
    const before = [{ fromDate: "2026-10-12", toDate: "2026-10-13" }];
    assert.deepEqual(applyMove(before, ["2026-10-19"], "2026-10-21"), [
      { fromDate: "2026-10-12", toDate: "2026-10-13" },
      { fromDate: "2026-10-19", toDate: "2026-10-21" },
    ]);
  });
  it("re-targets an occurrence that was itself moved in (no chains)", () => {
    const out = applyMove([{ fromDate: "2026-10-19", toDate: "2026-10-21" }], ["2026-10-21"], "2026-10-23");
    assert.deepEqual(out, [{ fromDate: "2026-10-19", toDate: "2026-10-23" }]);
    assert.ok(!out.some((m) => out.some((n) => n.toDate === m.fromDate)), "no move starts where another ends");
  });
  it("moving back to the original day removes the move", () => {
    assert.deepEqual(applyMove([{ fromDate: "2026-10-19", toDate: "2026-10-21" }], ["2026-10-21"], "2026-10-19"), []);
  });
  it("moves several dates at once (rescheduling an overdue chore)", () => {
    assert.deepEqual(applyMove([], ["2026-10-19", "2026-10-22"], "2026-10-24"), [
      { fromDate: "2026-10-19", toDate: "2026-10-24" },
      { fromDate: "2026-10-22", toDate: "2026-10-24" },
    ]);
  });
  it("several dates where one was moved in: re-targets it and adds the rest", () => {
    const out = applyMove([{ fromDate: "2026-10-19", toDate: "2026-10-21" }], ["2026-10-21", "2026-10-22"], "2026-10-24");
    assert.deepEqual(out, [
      { fromDate: "2026-10-19", toDate: "2026-10-24" },
      { fromDate: "2026-10-22", toDate: "2026-10-24" },
    ]);
  });
  it("moving onto a day it already occurs merges (one occurrence there)", () => {
    const out = applyMove([], ["2026-10-19"], "2026-10-22");
    assert.deepEqual(out, [{ fromDate: "2026-10-19", toDate: "2026-10-22" }]);
    assert.deepEqual(occurrences(LAUNDRY, "2026-10-19", "2026-10-25", stored(LAUNDRY, out)), ["2026-10-22"]);
  });
  it("from === to is a no-op", () => {
    assert.deepEqual(applyMove([], ["2026-10-19"], "2026-10-19"), []);
    const before = [{ fromDate: "2026-10-19", toDate: "2026-10-21" }];
    assert.deepEqual(applyMove(before, ["2026-10-21"], "2026-10-21"), before);
  });
  it("a date already moved away isn't moved again", () => {
    const before = [{ fromDate: "2026-10-19", toDate: "2026-10-21" }];
    assert.deepEqual(applyMove(before, ["2026-10-19"], "2026-10-23"), before);
  });
  it("de-duplicates identical moves and repeated from dates", () => {
    const dup = { fromDate: "2026-10-19", toDate: "2026-10-21" };
    assert.deepEqual(applyMove([dup, { ...dup }], ["2026-10-22"], "2026-10-23"), [dup, { fromDate: "2026-10-22", toDate: "2026-10-23" }]);
    assert.deepEqual(applyMove([], ["2026-10-19", "2026-10-19"], "2026-10-21"), [dup]);
  });
  it("drops stale self-moves", () => {
    assert.deepEqual(applyMove([{ fromDate: "2026-10-19", toDate: "2026-10-19" }], [], "2026-10-21"), []);
  });
  it("is pure, so undo is restoring the previous list", () => {
    const before: ChoreMove[] = [{ fromDate: "2026-10-19", toDate: "2026-10-21" }];
    const snapshot = structuredClone(before);
    const after = applyMove(before, ["2026-10-21"], "2026-10-23");
    assert.deepEqual(before, snapshot); // input untouched
    assert.notEqual(after, before);
    assert.notEqual(after[0], before[0]);
    // Undo: the old list gives the old schedule back exactly.
    assert.deepEqual(occurrences(LAUNDRY, "2026-10-19", "2026-10-25", stored(LAUNDRY, after)), ["2026-10-22", "2026-10-23"]);
    assert.deepEqual(occurrences(LAUNDRY, "2026-10-19", "2026-10-25", stored(LAUNDRY, before)), ["2026-10-21", "2026-10-22"]);
  });
  // KNOWN GAP (reported to coordinator): after a merge (Mon 19 moved onto Thu 22, a pattern day),
  // moving "the Thu 22 occurrence" re-targets only the moved-in Mon; the pattern Thu stays put —
  // so rescheduling a merged overdue chore leaves it overdue. applyMove can't see the pattern.
  it("moving a merged day moves both the moved-in and the pattern occurrence", () => {
    const isPattern = (d: string) => isScheduledOn(LAUNDRY, d);
    const merged = applyMove([], ["2026-10-19"], "2026-10-22", isPattern);
    const fromDates = outstandingDates(LAUNDRY, [], "2026-10-23", stored(LAUNDRY, merged));
    const out = stored(LAUNDRY, applyMove(merged, fromDates, "2026-10-24", isPattern));
    assert.equal(outstandingSince(LAUNDRY, [], "2026-10-23", out), null);
    assert.equal(occursOn(LAUNDRY, "2026-10-24", out), true);
  });
  it("moving a merged day back to the moved-in origin keeps the pattern day moved too", () => {
    const isPattern = (d: string) => isScheduledOn(LAUNDRY, d);
    const merged = applyMove([], ["2026-10-19"], "2026-10-22", isPattern);
    const back = applyMove(merged, ["2026-10-22"], "2026-10-19", isPattern);
    assert.deepEqual(back, [{ fromDate: "2026-10-22", toDate: "2026-10-19" }]);
  });
  it("round-trip: move away, move again, then back leaves no moves", () => {
    const a = applyMove([], ["2026-10-22"], "2026-10-24");
    const b = applyMove(a, ["2026-10-24"], "2026-10-25");
    assert.deepEqual(b, [{ fromDate: "2026-10-22", toDate: "2026-10-25" }]);
    assert.deepEqual(applyMove(b, ["2026-10-25"], "2026-10-22"), []);
  });
});

/* ---- capacity ---- */

describe("plannedLoadOn", () => {
  it("sums points of chores due that day", () => {
    assert.equal(plannedLoadOn(seed, "2026-10-19"), 20);
    assert.equal(plannedLoadOn(seed, "2026-10-21"), 10);
    assert.equal(plannedLoadOn(seed, "2026-10-23"), 0);
    assert.equal(plannedLoadOn([], "2026-10-19"), 0);
  });
  it("uses each chore's own points", () => {
    const cs = [chore({ id: "a", points: 25 }), chore({ id: "b", points: 5 }), chore({ id: "z", points: 0 })];
    assert.equal(plannedLoadOn(cs, "2026-10-19"), 30);
  });
  it("falls back to DEFAULT_POINTS for NaN / negative / non-finite points", () => {
    assert.equal(DEFAULT_POINTS, 10);
    for (const points of [NaN, -5, Infinity]) {
      assert.equal(plannedLoadOn([chore({ points })], "2026-10-19"), DEFAULT_POINTS, String(points));
    }
  });
  it("follows moves", () => {
    const moves = [mv(LAUNDRY, "2026-10-22", "2026-10-23")];
    assert.equal(plannedLoadOn(seed, "2026-10-22", moves), 10);
    assert.equal(plannedLoadOn(seed, "2026-10-23", moves), 10);
    assert.equal(plannedLoadOn(seed, "2026-10-22", [mv(LAUNDRY, "2026-10-19", "2026-10-22")]), 20); // merged: counted once
  });
  it("ignores paused chores and days before the start", () => {
    assert.equal(plannedLoadOn([chore({ active: false })], "2026-10-19"), 0);
    assert.equal(plannedLoadOn([chore({ addedDate: "2026-10-20" })], "2026-10-19"), 0);
  });
});

describe("completedLoadOn", () => {
  it("sums points of chores marked done that day", () => {
    const logs = [done(LAUNDRY.id, "2026-10-22"), done(NAILS.id, "2026-10-22"), done(BOTTLE.id, "2026-10-21")];
    assert.equal(completedLoadOn(seed, logs, "2026-10-22"), 20);
    assert.equal(completedLoadOn(seed, logs, "2026-10-21"), 10);
    assert.equal(completedLoadOn(seed, logs, "2026-10-20"), 0);
  });
  it("counts a chore once even if logged twice", () => {
    assert.equal(completedLoadOn(seed, [done(LAUNDRY.id, "2026-10-22"), done(LAUNDRY.id, "2026-10-22")], "2026-10-22"), 10);
  });
  it("ignores done:false and unknown chores, and isn't limited to scheduled days", () => {
    const logs = [done(LAUNDRY.id, "2026-10-23", { done: false }), done("ghost", "2026-10-23"), done(BOTTLE.id, "2026-10-23")];
    assert.equal(completedLoadOn(seed, logs, "2026-10-23"), 10);
  });
  it("uses points (with the DEFAULT_POINTS fallback)", () => {
    const cs = [chore({ id: "a", points: 30 }), chore({ id: "b", points: NaN }), chore({ id: "c", points: -1 })];
    const logs = ["a", "b", "c"].map((id) => done(id, "2026-10-19"));
    assert.equal(completedLoadOn(cs, logs, "2026-10-19"), 30 + DEFAULT_POINTS + DEFAULT_POINTS);
  });
});

describe("todayLoad", () => {
  it("planned = overdue + due + done; done = done", () => {
    assert.deepEqual(todayLoad({ overdue: [], due: [], done: [] }), { planned: 0, done: 0 });
    // Thu 22, nothing done: 5 overdue (Laundry/Bottle appear once).
    assert.deepEqual(todayLoad(choresForDay(seed, [], "2026-10-22")), { planned: 50, done: 0 });
    const logs = [done(LAUNDRY.id, "2026-10-22"), done(NAILS.id, "2026-10-22")];
    assert.deepEqual(todayLoad(choresForDay(seed, logs, "2026-10-22")), { planned: 50, done: 20 });
  });
  it("uses chore points with the DEFAULT_POINTS fallback", () => {
    const a = chore({ id: "a", points: 40 });
    const b = chore({ id: "b", points: NaN });
    const c = chore({ id: "c", points: 7 });
    const day = { overdue: [{ chore: a, since: "2026-10-12" }], due: [b], done: [{ chore: c, logId: "x" }] };
    assert.deepEqual(todayLoad(day), { planned: 40 + DEFAULT_POINTS + 7, done: 7 });
  });
  it("reflects moves through choresForDay", () => {
    const moves = stored(LAUNDRY, applyMove([], outstandingDates(LAUNDRY, [], "2026-10-22"), "2026-10-24"));
    assert.deepEqual(todayLoad(choresForDay(seed, [], "2026-10-22", moves)), { planned: 40, done: 0 });
  });
});

describe("capacityLevel", () => {
  it("boundaries at the default capacity", () => {
    assert.equal(DEFAULT_CAPACITY, 100);
    assert.equal(capacityLevel(0, 100), 0);
    assert.equal(capacityLevel(-5, 100), 0);
    assert.equal(capacityLevel(1, 100), 1);
    assert.equal(capacityLevel(69, 100), 1);
    assert.equal(capacityLevel(69.9, 100), 1);
    assert.equal(capacityLevel(70, 100), 2);
    assert.equal(capacityLevel(100, 100), 2);
    assert.equal(capacityLevel(101, 100), 3);
    assert.equal(capacityLevel(250, 100), 3);
  });
  it("is a percentage of any capacity", () => {
    assert.equal(capacityLevel(13, 20), 1); // 65%
    assert.equal(capacityLevel(14, 20), 2); // exactly 70%
    assert.equal(capacityLevel(7, 10), 2); // 0.7 * 100 must not round under 70
    assert.equal(capacityLevel(21, 30), 2);
    assert.equal(capacityLevel(20, 20), 2);
    assert.equal(capacityLevel(21, 20), 3);
  });
  it("capacity 0 / 1 edges don't divide by zero", () => {
    assert.equal(capacityLevel(0, 0), 0);
    assert.equal(capacityLevel(1, 1), 2);
    assert.equal(capacityLevel(2, 1), 3);
    assert.equal(capacityLevel(1, 0), 2); // treated as capacity 1
    assert.equal(capacityLevel(5, 0), 3);
  });
});

describe("lightestDay", () => {
  const TODAY = "2026-10-19"; // Mon; window = Tue 20 … Mon 26
  const target = chore({ id: "t", name: "Target", days: [1], points: 10 });
  /** A filler chore putting `points` on each of `days` (weekly). */
  let fillSeq = 0;
  const fill = (days: Chore["days"], points: number) => chore({ id: `f${++fillSeq}`, name: `Fill ${fillSeq}`, days, points });

  it("looks LIGHTEST_DAY_WINDOW days ahead, never today or earlier", () => {
    assert.equal(LIGHTEST_DAY_WINDOW, 7);
    assert.deepEqual(lightestDay([target], [], target, TODAY, TODAY, 100), { date: "2026-10-20", load: 0 });
    const every = chore({ id: "e", days: [1, 2, 3, 4, 5, 6, 7] });
    // Free only on Mon 26 (day 7 of the window) → found.
    assert.deepEqual(lightestDay([every], [mv(every, "2026-10-26", "2026-10-24")], every, TODAY, TODAY, 100), { date: "2026-10-26", load: 0 });
    // Free only on Tue 27 (day 8) → outside the window.
    assert.equal(lightestDay([every], [mv(every, "2026-10-27", "2026-10-24")], every, TODAY, TODAY, 100), null);
  });
  it("returns null when the chore already occurs on every day of the window", () => {
    const daily = chore({ id: "d", days: [1, 2, 3, 4, 5, 6, 7] });
    assert.equal(lightestDay([daily], [], daily, TODAY, TODAY, 100), null);
  });
  it("skips days the chore already occurs on (pattern and moved-in)", () => {
    const monTue = chore({ id: "mt", days: [1, 2] });
    assert.equal(lightestDay([monTue], [], monTue, TODAY, TODAY, 100)?.date, "2026-10-21");
    const moves = [mv(target, "2026-10-26", "2026-10-20")]; // Mon 26 pulled onto Tue 20
    assert.equal(lightestDay([target], moves, target, TODAY, TODAY, 100)?.date, "2026-10-21");
  });
  it("a day the chore was moved away from is a candidate again", () => {
    const monTue = chore({ id: "mt", days: [1, 2] });
    assert.equal(lightestDay([monTue], [mv(monTue, "2026-10-20", "2026-10-23")], monTue, TODAY, TODAY, 100)?.date, "2026-10-20");
  });
  it("prefers the lowest load, earliest on ties", () => {
    const free = chore({ id: "free", days: [] });
    const cs = [free, fill([2, 3, 5], 60), fill([4], 30), fill([1], 30), fill([6, 7], 50)];
    assert.deepEqual(lightestDay(cs, [], free, TODAY, TODAY, 100), { date: "2026-10-22", load: 30 }); // Thu 22, not Mon 26
  });
  it("prefers a weekday over a lighter weekend day", () => {
    const cs = [target, fill([1, 2, 3, 4, 5], 60)];
    assert.deepEqual(lightestDay(cs, [], target, TODAY, TODAY, 100), { date: "2026-10-20", load: 60 });
  });
  it("prefers a day it fits on over a weekday it would overflow", () => {
    const cs = [target, fill([1, 2, 3, 4, 5], 95), fill([6], 50), fill([7], 40)];
    assert.deepEqual(lightestDay(cs, [], target, TODAY, TODAY, 100), { date: "2026-10-25", load: 40 });
  });
  it("exactly reaching capacity still fits", () => {
    const cs = [target, fill([1, 2, 3, 4, 5], 90)];
    assert.deepEqual(lightestDay(cs, [], target, TODAY, TODAY, 100), { date: "2026-10-20", load: 90 });
  });
  it("when nothing fits: weekday first, then lowest load", () => {
    const cs = [target, fill([1, 2, 3, 4], 95), fill([5], 92), fill([6, 7], 91)];
    assert.deepEqual(lightestDay(cs, [], target, TODAY, TODAY, 100), { date: "2026-10-23", load: 92 });
  });
  it("fit uses the chore's own points (DEFAULT_POINTS when invalid) and the given capacity", () => {
    const cs = [fill([1, 2, 3, 4, 5], 35)];
    const big = chore({ id: "big", days: [], points: 20 });
    assert.equal(lightestDay([...cs, big], [], big, TODAY, TODAY, 50)?.date, "2026-10-24"); // 35 + 20 > 50
    const nan = chore({ id: "nan", days: [], points: NaN });
    assert.equal(lightestDay([...cs, nan], [], nan, TODAY, TODAY, 50)?.date, "2026-10-20"); // 35 + 10 ≤ 50
  });
  it("load is the day's load before adding the chore and follows other chores' moves", () => {
    const other = fill([2], 40);
    const cs = [target, other, fill([3, 4, 5, 1], 10)];
    assert.deepEqual(lightestDay(cs, [], target, TODAY, TODAY, 100), { date: "2026-10-21", load: 10 });
    // Move the Tue filler onto Wed → Tue is empty, Wed 50.
    const moves = [mv(other, "2026-10-20", "2026-10-21")];
    assert.deepEqual(lightestDay(cs, moves, target, TODAY, TODAY, 100), { date: "2026-10-20", load: 0 });
    // Paused chores don't count.
    assert.deepEqual(lightestDay([target, { ...other, active: false }], [], target, TODAY, TODAY, 100), { date: "2026-10-20", load: 0 });
  });
  it("starts after fromISO when it's in the future, after today when it's past", () => {
    // Moving next Monday's occurrence: window Tue 27 … Mon Nov 2.
    assert.deepEqual(lightestDay([target], [], target, "2026-10-26", TODAY, 100), { date: "2026-10-27", load: 0 });
    // Overdue occurrence from last week: window still starts after today.
    assert.deepEqual(lightestDay([target], [], target, "2026-10-12", TODAY, 100), { date: "2026-10-20", load: 0 });
    // From a Saturday: Sun 25 is earlier but Mon 26 is a weekday.
    const free = chore({ id: "free", days: [] });
    assert.deepEqual(lightestDay([free], [], free, "2026-10-24", "2026-10-24", 100), { date: "2026-10-26", load: 0 });
    assert.deepEqual(lightestDay([target], [], target, "2026-10-24", "2026-10-24", 100), { date: "2026-10-27", load: 0 }); // Mon 26 is its own day
  });
});
