import Link from "next/link";
import { getChores, getChoreLogs } from "@/lib/data";
import { istToday } from "@/lib/core/logic";
import {
  CHORE_LOG_DAYS, addDaysISO, choresDueOn, choresForDay, describeSchedule,
} from "@/lib/chores/logic";
import { SectionLabel } from "./ui";
import ChoreDueCard from "./chore-due-card";
import ChoreDoneCard from "./chore-done-card";
import CollapsiblePanel from "./collapsible-panel";

/** "Mon 19 Oct" for an ISO date (formatted in UTC so the day never shifts). */
function shortDay(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}

/** The Home screen's chores panel: overdue, due today, done today. */
export default async function ChoresToday() {
  const [chores, logs] = await Promise.all([getChores(), getChoreLogs(CHORE_LOG_DAYS)]);
  const today = istToday();
  const { overdue, due, done } = choresForDay(chores, logs, today);
  const outstanding = overdue.length + due.length;

  // When nothing is outstanding, point at the next day that has chores (within a week).
  let next: { date: string; names: string[] } | null = null;
  if (outstanding === 0) {
    for (let i = 1; i <= 7 && !next; i++) {
      const d = addDaysISO(today, i);
      const list = choresDueOn(chores, d);
      if (list.length) next = { date: d, names: list.map((c) => c.name) };
    }
  }

  const summary =
    outstanding === 0
      ? (done.length ? `All ${done.length} done` : "Nothing due")
      : [
          due.length ? `${due.length} due` : "",
          overdue.length ? `${overdue.length} overdue` : "",
          done.length ? `${done.length} done` : "",
        ].filter(Boolean).join(" · ");

  return (
    <CollapsiblePanel id="chores" title="🧹 Chores" summary={summary}>
      {overdue.length > 0 && (
        <>
          <SectionLabel>Overdue</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {overdue.map(({ chore, since }) => (
              <ChoreDueCard key={chore.id} id={chore.id} name={chore.name}
                detail={describeSchedule(chore)} overdueSince={shortDay(since)} />
            ))}
          </div>
        </>
      )}

      {due.length > 0 && (
        <>
          <SectionLabel>Today</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {due.map((c) => (
              <ChoreDueCard key={c.id} id={c.id} name={c.name} detail={describeSchedule(c)} />
            ))}
          </div>
        </>
      )}

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
