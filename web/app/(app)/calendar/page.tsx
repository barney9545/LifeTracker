import Link from "next/link";
import { getItems, getLogs } from "@/lib/data";
import { daysBetween, istToday } from "@/lib/core/logic";
import MonthCalendar from "@/components/month-calendar";

export const dynamic = "force-dynamic";

/** Shift a "YYYY-MM" month by delta months. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const today = istToday();
  const currentMonth = today.slice(0, 7); // YYYY-MM
  const month = /^\d{4}-\d{2}$/.test(m ?? "") && (m as string) <= currentMonth ? (m as string) : currentMonth;

  const monthStart = `${month}-01`;
  // Enough prior history for frequency-aware "due" at the start of the month.
  const n = Math.max(1, daysBetween(today, monthStart)) + 40;
  const [items, logs] = await Promise.all([getItems(), getLogs(n)]);
  const active = items.filter((i) => i.active);

  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);
  const hasNext = nextMonth <= currentMonth;

  const title = new Date(monthStart + "T00:00:00").toLocaleDateString("en-GB", {
    month: "long", year: "numeric",
  });

  return (
    <>
      <header className="flex items-center justify-between pb-4">
        <Link href="/" className="text-[13px] text-[var(--c-accent)]">← Today</Link>
        <h1 className="text-[18px] font-semibold tracking-tight text-[var(--c-text)]">{title}</h1>
        <div className="flex gap-1.5">
          <Link href={`/calendar?m=${prevMonth}`} aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[13px] text-[var(--c-text)] transition active:scale-90">
            ◀
          </Link>
          {hasNext ? (
            <Link href={`/calendar?m=${nextMonth}`} aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[13px] text-[var(--c-text)] transition active:scale-90">
              ▶
            </Link>
          ) : (
            <span aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[13px] text-[var(--c-muted)] opacity-30">
              ▶
            </span>
          )}
        </div>
      </header>

      <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
        <MonthCalendar month={month} items={active} logs={logs} />
        <p className="mt-3 text-[10px] text-[var(--c-muted)]">
          🟢 85%+  🟣 60–84%  🟡 40–59%  🔴 below 40% · tap a day to view/edit
        </p>
      </div>
    </>
  );
}
