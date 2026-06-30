import { getItems, getLogs, getAiSummary } from "@/lib/data";
import {
  alreadyDoneToday, computeStreak, isDue, streakLabel, timeOfDayRank, todayISO,
} from "@/lib/core/logic";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { SectionLabel, todColor } from "@/components/ui";
import DueCard from "@/components/due-card";
import DoneCard from "@/components/done-card";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage() {
  const [items, logs, ai] = await Promise.all([
    getItems(),
    getLogs(30),
    getAiSummary(),
  ]);

  const active = items
    .filter((i) => i.active)
    .sort((a, b) => timeOfDayRank(a.timeOfDay) - timeOfDayRank(b.timeOfDay));

  const due = [], done = [], notDue = [];
  for (const s of active) {
    if (alreadyDoneToday(s.id, logs)) done.push(s);
    else if (isDue(s, logs)) due.push(s);
    else notDue.push(s);
  }

  const activeCount = active.length;
  const pct = activeCount > 0 ? Math.round((done.length / activeCount) * 100) : 0;
  const today = todayISO();
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });

  return (
    <>
      <header className="flex items-center justify-between pb-5">
        <div>
          <p className="text-[13px] text-[var(--c-muted)]">{greeting()}</p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">{dateLabel}</h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-[15px] font-semibold text-[var(--c-accent)]">
          D
        </div>
      </header>

      {ai?.short && (
        <div className="mb-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent)]">✨ AI Insight</p>
          <p className="text-[13.5px] leading-relaxed text-[var(--c-text)]">{ai.short}</p>
        </div>
      )}

      <div className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[13px] font-medium text-[var(--c-text)]">Today&apos;s progress</span>
          <span className="text-[13px] font-semibold text-[var(--c-accent)]">{pct}%</span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
          <div className="h-full rounded-full bg-[var(--c-accent)] transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between">
          {[
            { label: "Due", value: due.length, color: "var(--c-due)" },
            { label: "Done", value: done.length, color: "var(--c-done)" },
            { label: "Active", value: activeCount, color: "var(--c-accent)" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className="text-[20px] font-semibold leading-none" style={{ color: s.color }}>{s.value}</span>
              <span className="mt-1 text-[11px] text-[var(--c-muted)]">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {due.length > 0 && (
        <>
          <SectionLabel>Due now</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {due.map((s) => {
              const n = computeStreak(s.name, logs, s.frequency);
              return (
                <DueCard key={s.id} id={s.id} name={s.name} detail={T.detail(s)}
                  streak={n > 0 ? streakLabel(n) : undefined} dotColor={todColor(s.timeOfDay)} />
              );
            })}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <SectionLabel>Done today</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {done.map((s) => {
              const te = logs.filter((l) => l.itemId === s.id && l.date === today && l.done);
              const last = te.length ? te[te.length - 1] : null;
              return (
                <DoneCard key={s.id} logId={last?.id ?? ""} name={s.name}
                  detail={`${s.meta.dosage ?? ""} ${s.meta.unit ?? ""}`.trim()}
                  time={last?.time} />
              );
            })}
          </div>
        </>
      )}

      {notDue.length > 0 && (
        <details className="mt-6 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
          <summary className="cursor-pointer list-none text-[13px] text-[var(--c-muted)]">🕐 Not due yet ({notDue.length})</summary>
          <div className="mt-2 flex flex-col gap-1.5">
            {notDue.map((s) => (
              <div key={s.id} className="text-[13px] text-[var(--c-text)]">
                <span className="font-medium">{s.name}</span>
                <span className="text-[var(--c-muted)]"> · {s.frequency}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {due.length === 0 && done.length === 0 && (
        <div className="mt-8 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-text)]">
          🎉 Nothing due right now. You&apos;re on top of it!
        </div>
      )}
    </>
  );
}
