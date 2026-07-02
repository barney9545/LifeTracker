import Link from "next/link";
import { notFound } from "next/navigation";
import { getItems, getLogs } from "@/lib/data";
import { dayBuckets, dayCompliance, istToday, timeOfDayRank } from "@/lib/core/logic";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { SectionLabel } from "@/components/ui";
import DoneCard from "@/components/done-card";
import MissedCard from "@/components/missed-card";

export const dynamic = "force-dynamic";

/** Add/subtract days from an ISO date string (UTC-safe date math). */
function shiftISO(iso: string, delta: number): string {
  return new Date(Date.parse(iso + "T00:00:00Z") + delta * 86_400_000).toISOString().slice(0, 10);
}

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const today = istToday();
  // Validate: well-formed YYYY-MM-DD and not in the future.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) notFound();

  const [items, logs] = await Promise.all([getItems(), getLogs(365)]);
  const active = items
    .filter((i) => i.active)
    .sort((a, b) => timeOfDayRank(a.timeOfDay) - timeOfDayRank(b.timeOfDay));

  const buckets = dayBuckets(active, logs, date);
  const { due, taken, pct } = dayCompliance(active, logs, date);

  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const prev = shiftISO(date, -1);
  const next = shiftISO(date, 1);
  const hasNext = next <= today;

  const nothing = buckets.taken.length === 0 && buckets.missed.length === 0;

  return (
    <>
      <header className="flex items-center justify-between pb-5">
        <div className="min-w-0">
          <Link href="/calendar" className="text-[13px] text-[var(--c-accent)]">← Calendar</Link>
          <h1 className="truncate text-[20px] font-semibold tracking-tight text-[var(--c-text)]">{dateLabel}</h1>
          <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">
            {due > 0 ? `${taken}/${due} taken · ${pct}%` : "Nothing was due"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Link href={`/day/${prev}`} aria-label="Previous day"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[14px] text-[var(--c-text)] transition active:scale-90">
            ◀
          </Link>
          {hasNext ? (
            <Link href={`/day/${next}`} aria-label="Next day"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[14px] text-[var(--c-text)] transition active:scale-90">
              ▶
            </Link>
          ) : (
            <span aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[14px] text-[var(--c-muted)] opacity-30">
              ▶
            </span>
          )}
        </div>
      </header>

      {buckets.taken.length > 0 && (
        <>
          <SectionLabel>Taken</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {buckets.taken.map((e) => (
              <DoneCard key={e.item.id} logId={e.logId} name={e.item.name}
                detail={`${e.item.meta.dosage ?? ""} ${e.item.meta.unit ?? ""}`.trim()}
                time={e.time} />
            ))}
          </div>
        </>
      )}

      {buckets.missed.length > 0 && (
        <>
          <SectionLabel>Missed</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {buckets.missed.map((s) => (
              <MissedCard key={s.id} id={s.id} name={s.name} detail={T.detail(s)} dateISO={date} />
            ))}
          </div>
        </>
      )}

      {buckets.notDue.length > 0 && (
        <details className="mt-6 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
          <summary className="cursor-pointer list-none text-[13px] text-[var(--c-muted)]">🕐 Not due yet ({buckets.notDue.length})</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {buckets.notDue.map((s) => (
              <div key={s.id} className="text-[13px] text-[var(--c-text)]">
                <span className="font-medium">{s.name}</span>
                <span className="text-[var(--c-muted)]"> · {s.frequency}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {nothing && (
        <div className="mt-8 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-text)]">
          Nothing was due on this day.
        </div>
      )}
    </>
  );
}
