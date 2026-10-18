import { test } from "node:test";
import assert from "node:assert/strict";
import type { LogEntry } from "../core/types";
import { applyMove, outstandingDates } from "./logic";
import { buildNightlyReminder, formatChoreReminderTelegram, isReminderEmpty, shortDate } from "./reminder";
import { SEED_CHORES, SEED_START } from "./seed";
import type { Chore, StoredChoreMove } from "./types";

// Seeded chores as the store would hold them (ids c1…c6, all starting Mon 19 Oct).
const CHORES: Chore[] = SEED_CHORES.map((c, i) => ({ ...c, id: `c${i + 1}`, addedDate: SEED_START }));
const byName = (name: string) => CHORES.find((c) => c.name === name)!;
const BED = "Change bed sheets & pillow covers";

function done(name: string, date: string): LogEntry {
  const c = byName(name);
  return { id: `${c.id}-${date}`, itemId: c.id, itemName: c.name, date, done: true, time: "", notes: "" };
}

const names = (ts: { chore: Chore }[]) => ts.map((t) => t.chore.name);
const overdueOf = (r: ReturnType<typeof buildNightlyReminder>) => r.overdue.map((o) => [o.chore.name, o.since]);

test("shortDate formats from the ISO string", () => {
  assert.equal(shortDate("2026-10-20"), "Tue 20 Oct");
  assert.equal(shortDate("2027-01-03"), "Sun 3 Jan");
});

test("Sun 18 Oct: Monday's chores, nothing overdue before the start date", () => {
  const r = buildNightlyReminder(CHORES, [], "2026-10-18");
  assert.equal(r.date, "2026-10-19");
  assert.deepEqual(names(r.tomorrow), ["Laundry", "Wash bottle"]);
  assert.deepEqual(r.overdue, []);
  assert.equal(isReminderEmpty(r), false);
});

test("Mon 19 Oct, nothing done: today's undone chores roll into overdue", () => {
  const r = buildNightlyReminder(CHORES, [], "2026-10-19");
  assert.equal(r.date, "2026-10-20");
  assert.deepEqual(names(r.tomorrow), ["Clean beard", "Trim nails"]);
  assert.deepEqual(overdueOf(r), [
    ["Laundry", "2026-10-19"],
    ["Wash bottle", "2026-10-19"],
  ]);
});

test("Mon 19 Oct, both done: only tomorrow", () => {
  const r = buildNightlyReminder(CHORES, [done("Laundry", "2026-10-19"), done("Wash bottle", "2026-10-19")], "2026-10-19");
  assert.deepEqual(names(r.tomorrow), ["Clean beard", "Trim nails"]);
  assert.deepEqual(r.overdue, []);
});

test("Thu 22 Oct, all caught up: Friday is free → empty", () => {
  const logs = [
    done("Laundry", "2026-10-22"),
    done("Wash bottle", "2026-10-22"),
    done("Trim nails", "2026-10-20"),
    done("Clean beard", "2026-10-20"),
    done(BED, "2026-10-21"),
  ];
  const r = buildNightlyReminder(CHORES, logs, "2026-10-22");
  assert.equal(r.date, "2026-10-23");
  assert.deepEqual(r.tomorrow, []);
  assert.deepEqual(r.overdue, []);
  assert.equal(isReminderEmpty(r), true);
});

test("a chore overdue and due tomorrow is listed once, under tomorrow, flagged overdue", () => {
  // Wed 21: Laundry missed since Mon and due again Thu; Wash bottle done Mon.
  const logs = [
    done("Wash bottle", "2026-10-19"),
    done("Trim nails", "2026-10-20"),
    done("Clean beard", "2026-10-20"),
    done(BED, "2026-10-21"),
  ];
  const r = buildNightlyReminder(CHORES, logs, "2026-10-21");
  assert.deepEqual(r.tomorrow.map((t) => [t.chore.name, t.overdueSince]), [
    ["Laundry", "2026-10-19"],
    ["Wash bottle", null],
  ]);
  assert.deepEqual(r.overdue, []);
  assert.equal(
    formatChoreReminderTelegram(r),
    "🧹 <b>Tomorrow · Thu 22 Oct</b>\n• Laundry · overdue since Mon 19 Oct\n• Wash bottle",
  );
});

test("overdue is oldest first", () => {
  // Wed 21, nothing done all week.
  const r = buildNightlyReminder(CHORES, [], "2026-10-21");
  assert.deepEqual(overdueOf(r), [
    ["Clean beard", "2026-10-20"],
    ["Trim nails", "2026-10-20"],
    [BED, "2026-10-21"],
  ]);
  assert.deepEqual(names(r.tomorrow), ["Laundry", "Wash bottle"]); // due Thu, flagged overdue
});

test("formatter: both sections", () => {
  const msg = formatChoreReminderTelegram(buildNightlyReminder(CHORES, [], "2026-10-19"));
  assert.equal(
    msg,
    [
      "🧹 <b>Tomorrow · Tue 20 Oct</b>",
      "• Clean beard",
      "• Trim nails",
      "",
      "⚠️ <b>Overdue</b>",
      "• Laundry · since Mon 19 Oct",
      "• Wash bottle · since Mon 19 Oct",
    ].join("\n"),
  );
});

test("formatter: omits an empty overdue section", () => {
  const msg = formatChoreReminderTelegram(buildNightlyReminder(CHORES, [], "2026-10-18"));
  assert.equal(msg, "🧹 <b>Tomorrow · Mon 19 Oct</b>\n• Laundry\n• Wash bottle");
});

test("formatter: free tomorrow still names the date, then overdue", () => {
  const logs = [
    done("Wash bottle", "2026-10-22"),
    done("Trim nails", "2026-10-20"),
    done("Clean beard", "2026-10-20"),
    done(BED, "2026-10-21"),
  ];
  const msg = formatChoreReminderTelegram(buildNightlyReminder(CHORES, logs, "2026-10-22"));
  assert.equal(msg, "🧹 <b>Tomorrow · Fri 23 Oct</b> — nothing scheduled\n\n⚠️ <b>Overdue</b>\n• Laundry · since Mon 19 Oct");
});

test("formatter: HTML-escapes chore names", () => {
  // Tue 20 (week A): bed sheets due Wed 21.
  const logs = [done("Laundry", "2026-10-19"), done("Wash bottle", "2026-10-19"), done("Trim nails", "2026-10-20"), done("Clean beard", "2026-10-20")];
  const msg = formatChoreReminderTelegram(buildNightlyReminder(CHORES, logs, "2026-10-20"));
  assert.ok(msg.includes("• Change bed sheets &amp; pillow covers"));
  assert.ok(!/&(?!amp;)/.test(msg));

  const odd: Chore = { ...byName("Laundry"), id: "x", name: "<b>Fix</b> sink > drain" };
  const msg2 = formatChoreReminderTelegram(buildNightlyReminder([odd], [], "2026-10-18"));
  assert.ok(msg2.includes("• &lt;b&gt;Fix&lt;/b&gt; sink &gt; drain"));
});

test("formatter: stays short — one line per chore plus headers", () => {
  const r = buildNightlyReminder(CHORES, [], "2026-10-21");
  const lines = formatChoreReminderTelegram(r).split("\n");
  assert.equal(lines.length, 1 + r.tomorrow.length + 2 + r.overdue.length);
  assert.ok(lines.every((l) => l.length <= 60));
});

/* ---- one-off moves ---- */

const mv = (name: string, fromDate: string, toDate: string): StoredChoreMove => ({ choreId: byName(name).id, fromDate, toDate });
/** Everything done through Thu 22 (week A). */
const CAUGHT_UP_THU = [
  done("Laundry", "2026-10-22"),
  done("Wash bottle", "2026-10-22"),
  done("Trim nails", "2026-10-20"),
  done("Clean beard", "2026-10-20"),
  done(BED, "2026-10-21"),
];

test("moves: a chore moved onto tomorrow is listed for tomorrow", () => {
  const moves = [mv("Laundry", "2026-10-26", "2026-10-24")]; // next Mon → Sat
  assert.equal(isReminderEmpty(buildNightlyReminder(CHORES, CAUGHT_UP_THU, "2026-10-23")), true);
  const r = buildNightlyReminder(CHORES, CAUGHT_UP_THU, "2026-10-23", moves);
  assert.equal(r.date, "2026-10-24");
  assert.deepEqual(r.tomorrow.map((t) => [t.chore.name, t.overdueSince]), [["Laundry", null]]);
  assert.deepEqual(r.overdue, []);
  assert.equal(formatChoreReminderTelegram(r), "🧹 <b>Tomorrow · Sat 24 Oct</b>\n• Laundry");
  // …and it's gone from its original Monday.
  const sun = buildNightlyReminder(CHORES, [...CAUGHT_UP_THU, done("Laundry", "2026-10-24")], "2026-10-25", moves);
  assert.deepEqual(names(sun.tomorrow), ["Wash bottle"]);
  assert.deepEqual(sun.overdue, []);
});

test("moves: a chore moved away from tomorrow is not listed", () => {
  const moves = [mv("Laundry", "2026-10-19", "2026-10-20")]; // Mon → Tue
  const sun = buildNightlyReminder(CHORES, [], "2026-10-18", moves);
  assert.deepEqual(names(sun.tomorrow), ["Wash bottle"]);
  assert.deepEqual(sun.overdue, []);
  // Monday night: not overdue (it isn't Monday's any more), listed for Tuesday instead.
  const mon = buildNightlyReminder(CHORES, [done("Wash bottle", "2026-10-19")], "2026-10-19", moves);
  assert.deepEqual(mon.tomorrow.map((t) => [t.chore.name, t.overdueSince]), [
    ["Clean beard", null],
    ["Laundry", null],
    ["Trim nails", null],
  ]);
  assert.deepEqual(mon.overdue, []);
});

test("moves: an overdue chore rescheduled to a later date is no longer overdue", () => {
  const logs = CAUGHT_UP_THU.filter((l) => l.itemName !== "Laundry"); // Laundry missed Mon + Thu
  const before = buildNightlyReminder(CHORES, logs, "2026-10-23");
  assert.deepEqual(overdueOf(before), [["Laundry", "2026-10-19"]]);

  const pending = outstandingDates(byName("Laundry"), logs, "2026-10-23");
  assert.deepEqual(pending, ["2026-10-19", "2026-10-22"]);
  const toSun = applyMove([], pending, "2026-10-25").map((m) => ({ choreId: byName("Laundry").id, ...m }));
  const r = buildNightlyReminder(CHORES, logs, "2026-10-23", toSun);
  assert.deepEqual(r.tomorrow, []);
  assert.deepEqual(r.overdue, []);
  assert.equal(isReminderEmpty(r), true);

  // Rescheduled to tomorrow: listed for tomorrow, not flagged overdue.
  const toSat = applyMove([], pending, "2026-10-24").map((m) => ({ choreId: byName("Laundry").id, ...m }));
  const r2 = buildNightlyReminder(CHORES, logs, "2026-10-23", toSat);
  assert.deepEqual(r2.tomorrow.map((t) => [t.chore.name, t.overdueSince]), [["Laundry", null]]);
  assert.deepEqual(r2.overdue, []);
});

test("moves: another chore's moves don't affect the rest", () => {
  const moves = [mv("Wash bottle", "2026-10-19", "2026-10-23")];
  const r = buildNightlyReminder(CHORES, [], "2026-10-18", moves);
  assert.deepEqual(names(r.tomorrow), ["Laundry"]);
});
