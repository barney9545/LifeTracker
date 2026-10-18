/**
 * Nightly chores reminder (≈9pm IST): tomorrow's chores plus anything still
 * outstanding. Split so the delivery channel can change later without touching
 * the logic:
 *   buildNightlyReminder        → what to say (pure data)
 *   formatChoreReminderTelegram → how Telegram shows it (HTML)
 * The cron route wires them to `sendTelegram`. (Pure, no I/O — `node --test` loads it.)
 */
import type { LogEntry } from "../core/types";
import { addDaysISO, choresDueOn, outstandingSince, WEEKDAY_LABELS, weekdayOf } from "./logic";
import type { Chore, StoredChoreMove } from "./types";

export interface NightlyReminder {
  /** Tomorrow, ISO yyyy-mm-dd. */
  date: string;
  /** Everything due tomorrow, sorted by name; `overdueSince` set if it's also still outstanding. */
  tomorrow: { chore: Chore; overdueSince: string | null }[];
  /** Not done by tonight — including today's undone chores — oldest first, minus
   *  any chore already listed under tomorrow. */
  overdue: { chore: Chore; since: string }[];
}

/** Built on the evening of `today`. A chore both overdue and due tomorrow is listed
 *  once, under tomorrow and flagged overdue — one completion clears both. */
export function buildNightlyReminder(
  chores: Chore[], logs: LogEntry[], today: string, moves: StoredChoreMove[] = [],
): NightlyReminder {
  const date = addDaysISO(today, 1);
  const since = new Map<string, string>();
  for (const chore of chores) {
    const s = outstandingSince(chore, logs, today, moves);
    if (s !== null) since.set(chore.id, s);
  }
  const tomorrow = choresDueOn(chores, date, moves).map((chore) => ({ chore, overdueSince: since.get(chore.id) ?? null }));
  const listed = new Set(tomorrow.map((t) => t.chore.id));
  const overdue = chores
    .filter((c) => since.has(c.id) && !listed.has(c.id))
    .map((chore) => ({ chore, since: since.get(chore.id)! }))
    .sort((a, b) => a.since.localeCompare(b.since) || a.chore.name.localeCompare(b.chore.name));
  return { date, tomorrow, overdue };
}

/** Nothing tomorrow and nothing outstanding → don't send anything. */
export function isReminderEmpty(r: NightlyReminder): boolean {
  return r.tomorrow.length === 0 && r.overdue.length === 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Tue 20 Oct" — straight from the ISO string, so the server timezone never matters. */
export function shortDate(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${WEEKDAY_LABELS[weekdayOf(iso)]} ${d} ${MONTHS[m - 1]}`;
}

/** Telegram parse mode is HTML — a bare `&` or `<` in a name breaks the whole message. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Telegram HTML. Empty sections are omitted; if tomorrow is free the header still names it. */
export function formatChoreReminderTelegram(r: NightlyReminder): string {
  const head = `🧹 <b>Tomorrow · ${shortDate(r.date)}</b>`;
  const sections: string[] = [
    r.tomorrow.length
      ? [head, ...r.tomorrow.map((t) =>
          `• ${esc(t.chore.name)}${t.overdueSince ? ` · overdue since ${shortDate(t.overdueSince)}` : ""}`,
        )].join("\n")
      : `${head} — nothing scheduled`,
  ];
  if (r.overdue.length) {
    sections.push(
      ["⚠️ <b>Overdue</b>", ...r.overdue.map((o) => `• ${esc(o.chore.name)} · since ${shortDate(o.since)}`)].join("\n"),
    );
  }
  return sections.join("\n\n");
}
