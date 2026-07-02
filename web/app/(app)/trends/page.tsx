import Link from "next/link";
import { getItems, getLogs, getAiSummary } from "@/lib/data";
import {
  complianceColor, complianceDays, computeStreak, streakLabel,
  dayBuckets, dayCompliance, daysAgoISO, istToday, timeOfDayRank,
} from "@/lib/core/logic";
import { signOut } from "@/lib/auth";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { SectionLabel } from "@/components/ui";
import Tabs from "@/components/tabs";
import DoneCard from "@/components/done-card";
import MissedCard from "@/components/missed-card";
import type { LogEntry, TrackableItem } from "@/lib/core/types";

export const dynamic = "force-dynamic";

/** Build the "History" list: one section per recent day back to the earliest addedDate. */
function historyDays(items: TrackableItem[], logs: LogEntry[]): string[] {
  const today = istToday();
  // Earliest effective added date across active items → floor the history window.
  let floor: string | null = null;
  for (const it of items) {
    let added: string | null = /^\d{4}-\d{2}-\d{2}/.test(it.addedDate ?? "")
      ? it.addedDate.slice(0, 10)
      : null;
    if (added === null) {
      for (const l of logs) {
        if (l.itemName === it.name && l.done && (added === null || l.date < added)) added = l.date;
      }
    }
    if (added && (floor === null || added < floor)) floor = added;
  }
  const days: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = daysAgoISO(i);
    if (floor && d < floor) break;
    if (d > today) continue;
    days.push(d);
  }
  return days;
}

export default async function TrendsPage() {
  const [items, logs, ai] = await Promise.all([
    getItems(), getLogs(365), getAiSummary(),
  ]);
  const active = items
    .filter((i) => i.active)
    .sort((a, b) => timeOfDayRank(a.timeOfDay) - timeOfDayRank(b.timeOfDay));

  const comp = active
    .map((i) => ({ name: i.name, ...complianceDays(i, logs) }))
    .sort((a, b) => b.pct - a.pct);
  const streaks = active
    .map((i) => ({ name: i.name, n: computeStreak(i.name, logs, i.frequency) }))
    .sort((a, b) => b.n - a.n);
  const raw = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 120);
  const history = historyDays(active, logs);

  const overview =
    logs.length === 0 ? (
      <div className="mt-6 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-muted)]">
        No log data yet. Start from the Today tab.
      </div>
    ) : (
      <>
          <SectionLabel>30-day compliance</SectionLabel>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            {comp.map((c) => (
              <div key={c.name} className="flex items-center gap-3">
                <div className="w-[96px] shrink-0 text-right">
                  <div className="truncate text-[12px] text-[var(--c-text)]">{c.name}</div>
                  {c.daysSince === null ? (
                    <div className="text-[10px] text-[#f87171]">never taken</div>
                  ) : c.daysSince >= 2 ? (
                    <div className="text-[10px] text-[#f87171]">{c.daysSince}d ago</div>
                  ) : (
                    <div className="text-[10px] text-[var(--c-muted)]">{c.takenDays}/{c.expectedDays}d</div>
                  )}
                </div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                  <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: complianceColor(c.pct) }} />
                </div>
                <span className="w-[40px] shrink-0 text-right text-[11px] text-[var(--c-muted)]">{c.pct}%</span>
              </div>
            ))}
            <p className="mt-1 text-[10px] text-[var(--c-muted)]">🟢 85%+  🟣 60–84%  🟡 40–59%  🔴 below 40% · since added</p>
          </div>

          <SectionLabel>Streaks</SectionLabel>
          <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4">
            {streaks.map((s, i) => (
              <div key={s.name}
                className={`flex items-center justify-between py-2.5 ${i > 0 ? "border-t border-[var(--c-border)]" : ""}`}>
                <span className="text-[13px] text-[var(--c-text)]">{s.name}</span>
                <span className="text-[12px]" style={{ color: s.n >= 7 ? "var(--c-done)" : s.n >= 3 ? "var(--c-accent)" : "var(--c-muted)" }}>
                  {s.n > 0 ? streakLabel(s.n) : "no streak"}
                </span>
              </div>
            ))}
          </div>

          <SectionLabel>AI summary</SectionLabel>
          {ai?.long ? (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-accent)]">
                Last updated {ai.updatedAt}
              </p>
              <p className="text-[13.5px] leading-relaxed text-[var(--c-text)]">{ai.long}</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4 text-[13px] text-[var(--c-muted)]">
              Your AI summary appears here after the next daily digest.
            </div>
          )}

          <details className="mt-6 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
            <summary className="cursor-pointer list-none text-[13px] text-[var(--c-muted)]">📜 Raw log ({raw.length})</summary>
            <div className="mt-2 flex flex-col gap-1">
              {raw.map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--c-muted)]">{l.date}</span>
                  <span className="flex-1 truncate px-2 text-[var(--c-text)]">{l.itemName}</span>
                  <span>{l.done ? "✅" : "❌"}</span>
                  <span className="ml-2 w-[42px] text-right text-[var(--c-muted)]">{l.time}</span>
                </div>
              ))}
            </div>
          </details>
        </>
      );

  const historyTab =
    history.length === 0 ? (
      <div className="mt-6 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-muted)]">
        No history yet.
      </div>
    ) : (
      <div className="flex flex-col gap-5">
        {history.map((d) => {
          const b = dayBuckets(active, logs, d);
          const { due, taken, pct } = dayCompliance(active, logs, d);
          const label = new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
            weekday: "short", day: "numeric", month: "short",
          });
          return (
            <div key={d}>
              <div className="mb-2 flex items-baseline justify-between">
                <Link href={`/day/${d}`} className="text-[13px] font-semibold text-[var(--c-text)]">{label}</Link>
                <span className="text-[11px] text-[var(--c-muted)]">
                  {due > 0 ? `${taken}/${due} · ${pct}%` : "nothing due"}
                </span>
              </div>
              {b.taken.length === 0 && b.missed.length === 0 ? (
                <p className="text-[12px] text-[var(--c-muted)]">Nothing was due.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {b.taken.map((e) => (
                    <DoneCard key={`t-${e.item.id}`} logId={e.logId} name={e.item.name}
                      detail={`${e.item.meta.dosage ?? ""} ${e.item.meta.unit ?? ""}`.trim()}
                      time={e.time} />
                  ))}
                  {b.missed.map((s) => (
                    <MissedCard key={`m-${s.id}`} id={s.id} name={s.name} detail={T.detail(s)} dateISO={d} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );

  return (
    <>
      <header className="pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">📊 Trends</h1>
        <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">Last 30 days</p>
      </header>

      <Tabs
        tabs={[
          { key: "overview", label: "Overview", content: overview },
          { key: "history", label: "History", content: historyTab },
        ]}
      />

      <form
        action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}
        className="mt-8"
      >
        <button type="submit"
          className="w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3 text-[14px] text-[var(--c-muted)] transition active:scale-[0.99]">
          🚪 Sign out
        </button>
      </form>
    </>
  );
}
