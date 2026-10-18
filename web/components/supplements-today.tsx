import { getItems, getLogs, getAiSummary } from "@/lib/data";
import {
  alreadyDoneToday, computeStreak, isDue, istToday, streakLabel, timeOfDayRank,
} from "@/lib/core/logic";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { SectionLabel, todColor } from "./ui";
import DueCard from "./due-card";
import DoneCard from "./done-card";
import CollapsiblePanel from "./collapsible-panel";
import PopupButton, { InfoIcon, SparkleIcon } from "./popup-button";
import ProgressCard from "./progress-card";

/** The Home screen's supplements panel: due / done / not-due, with AI insight + progress popups. */
export default async function SupplementsToday() {
  const [items, logs, ai] = await Promise.all([
    getItems(),
    getLogs(30),
    getAiSummary(),
  ]);

  const active = items
    .filter((i) => i.active)
    .sort(
      (a, b) =>
        timeOfDayRank(a.timeOfDay) - timeOfDayRank(b.timeOfDay) ||
        a.name.localeCompare(b.name),
    );

  const due = [], done = [], notDue = [];
  for (const s of active) {
    if (alreadyDoneToday(s.id, logs)) done.push(s);
    else if (isDue(s, logs)) due.push(s);
    else notDue.push(s);
  }

  const activeCount = active.length;
  // Progress is measured against what's actually due today (due + already done),
  // not every active item — a weekly supplement that isn't due today shouldn't
  // drag the percentage down.
  const dueToday = due.length + done.length;
  const pct = dueToday > 0 ? Math.round((done.length / dueToday) * 100) : 0;
  const today = istToday();

  // Header: a small % (stays informative while minimised), the AI insight and the
  // full progress card behind icon popups.
  const actions = (
    <>
      {ai?.short && (
        <PopupButton label="AI insight" icon={<SparkleIcon />}>
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent)]">✨ AI Insight</p>
            <p className="text-[13.5px] leading-relaxed text-[var(--c-text)]">{ai.short}</p>
          </div>
        </PopupButton>
      )}
      <PopupButton label="Supplements progress" icon={<InfoIcon />}>
        <ProgressCard title="Today's progress" pct={pct} stats={[
          { label: "Due", value: due.length, color: "var(--c-due)" },
          { label: "Done", value: done.length, color: "var(--c-done)" },
          { label: "Active", value: activeCount, color: "var(--c-accent)" },
        ]} />
      </PopupButton>
    </>
  );

  return (
    <CollapsiblePanel id="supplements" title={`${T.icon} ${T.labelPlural}`}
      summary={dueToday > 0 ? `${pct}%` : "—"} actions={actions}>

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
    </CollapsiblePanel>
  );
}
