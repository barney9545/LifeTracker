import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { LogEntry } from "../core/types";
import type { Chore } from "./types";
import { SEED_CHORES, SEED_START } from "./seed";
import {
  CHORE_LOG_DAYS,
  WEEK_A_START,
  addDaysISO,
  choresDueOn,
  choresForDay,
  describeSchedule,
  isActiveOn,
  isDueOn,
  isMonthWeek,
  isScheduledOn,
  outstandingSince,
  scheduleStart,
  weekOf,
  weekdayOf,
} from "./logic";

/* ---- helpers ---- */

function chore(over: Partial<Chore> = {}): Chore {
  return {
    id: "c1", name: "Chore", days: [1], frequency: "weekly", week: "A", monthWeek: 1,
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
