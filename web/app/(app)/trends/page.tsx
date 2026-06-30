import { getRepository } from "@/lib/repository";
import { complianceColor, complianceDays, computeStreak, streakLabel } from "@/lib/core/logic";
import { signOut } from "@/lib/auth";
import { SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const repo = getRepository();
  const [items, logs, ai] = await Promise.all([
    repo.getItems(), repo.getLogs(30), repo.getAiSummary(),
  ]);
  const active = items.filter((i) => i.active);

  const comp = active
    .map((i) => ({ name: i.name, ...complianceDays(i, logs) }))
    .sort((a, b) => b.pct - a.pct);
  const streaks = active
    .map((i) => ({ name: i.name, n: computeStreak(i.name, logs, i.frequency) }))
    .sort((a, b) => b.n - a.n);
  const raw = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 120);

  return (
    <>
      <header className="pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">📊 Trends</h1>
        <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">Last 30 days</p>
      </header>

      {logs.length === 0 ? (
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
      )}

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
