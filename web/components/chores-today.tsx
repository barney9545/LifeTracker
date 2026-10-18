import Link from "next/link";
import { getChores, getChoreLogs, getChoreMoves, getChoreCapacity } from "@/lib/data";
import { istToday } from "@/lib/core/logic";
import {
  CHORE_LOG_DAYS, addDaysISO, choresDueOn, choresForDay, describeSchedule, movedFrom, outstandingDates,
} from "@/lib/chores/logic";
import type { Chore } from "@/lib/chores/types";
import { SectionLabel } from "./ui";
import ChoreDoneCard from "./chore-done-card";
import CollapsiblePanel from "./collapsible-panel";
import PopupButton, { InfoIcon } from "./popup-button";
import ProgressCard from "./progress-card";
import RescheduleList from "./reschedule-list";
import { rescheduleChoices, shortDay, type ChoreItem } from "./reschedule-data";

/** The Home screen's chores panel: overdue, due today, done today. */
export default async function ChoresToday() {
  const [chores, logs, moves, capacity] = await Promise.all([
    getChores(), getChoreLogs(CHORE_LOG_DAYS), getChoreMoves(), getChoreCapacity(),
  ]);
  const today = istToday();
  // Moves go through the same buckets, so a rescheduled chore shows on its new day.
  const { overdue, due, done } = choresForDay(chores, logs, today, moves);
  const outstanding = overdue.length + due.length;

  // An outstanding chore plus its reschedule choices. Due today moves just today;
  // an overdue one moves every missed day (they collapse onto the new date).
  function toItem(chore: Chore, since?: string): ChoreItem {
    const fromDates = since ? outstandingDates(chore, logs, today, moves) : [today];
    const from = movedFrom(chore, today, moves);
    return {
      id: chore.id, name: chore.name, detail: describeSchedule(chore),
      overdueSince: since && shortDay(since), movedFrom: from ? shortDay(from) : undefined, fromDates,
      ...rescheduleChoices(chores, moves, chore, fromDates, today, capacity),
    };
  }

  // When nothing is outstanding, point at the next day that has chores (within a week).
  let next: { date: string; names: string[] } | null = null;
  if (outstanding === 0) {
    for (let i = 1; i <= 7 && !next; i++) {
      const d = addDaysISO(today, i);
      const list = choresDueOn(chores, d, moves);
      if (list.length) next = { date: d, names: list.map((c) => c.name) };
    }
  }

  // Progress against everything on today's list (overdue + due + done).
  const total = outstanding + done.length;
  const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

  const actions = (
    <PopupButton label="Chores progress" icon={<InfoIcon />}>
      <ProgressCard title="Today's chores" pct={pct} stats={[
        { label: "Overdue", value: overdue.length, color: "var(--c-due)" },
        { label: "Due", value: due.length, color: "var(--c-accent)" },
        { label: "Done", value: done.length, color: "var(--c-done)" },
      ]} />
    </PopupButton>
  );

  return (
    <CollapsiblePanel id="chores" title="🧹 Chores" summary={total > 0 ? `${pct}%` : "—"} actions={actions}>
      <RescheduleList today={today} capacity={capacity}
        overdue={overdue.map(({ chore, since }) => toItem(chore, since))}
        due={due.map((c) => toItem(c))} />

      {done.length > 0 && (
        <>
          <SectionLabel>Done today</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {done.map(({ chore, logId }) => (
              <ChoreDoneCard key={chore.id} logId={logId} name={chore.name} detail={describeSchedule(chore)} />
            ))}
          </div>
        </>
      )}

      {outstanding === 0 && (
        <div className={`${done.length ? "mt-4" : ""} rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 text-center`}>
          <p className="text-[14px] text-[var(--c-text)]">
            {done.length ? "All caught up 🎉" : "Nothing due today 🎉"}
          </p>
          {next && (
            <p className="mt-1 text-[12px] text-[var(--c-muted)]">
              Next: {shortDay(next.date)} · {next.names.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex justify-end">
        <Link href="/manage?tab=chores"
          className="rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--c-accent)] transition active:scale-95">
          All tasks →
        </Link>
      </div>
    </CollapsiblePanel>
  );
}
