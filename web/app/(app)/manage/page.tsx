import { getChoreCapacity, getChoreLogs, getChoreMoves, getChores, getItems } from "@/lib/data";
import { getRepository } from "@/lib/repository";
import { DEFAULT_GUIDANCE, DEFAULT_TEMPERATURE } from "@/lib/summary";
import { supplementsTracker as T } from "@/lib/trackers/supplements";
import { daysBetween, istToday } from "@/lib/core/logic";
import { CHORE_LOG_DAYS, isActiveOn } from "@/lib/chores/logic";
import { addItem } from "@/actions/items";
import { addChore } from "@/actions/chores";
import ItemForm from "@/components/item-form";
import ItemRow from "@/components/item-row";
import ChoreForm from "@/components/chore-form";
import ChoreRow from "@/components/chore-row";
import CapacityMonth from "@/components/capacity-month";
import CapacitySetting from "@/components/capacity-setting";
import SummaryPromptEditor from "@/components/summary-prompt-editor";
import Tabs from "@/components/tabs";
import { SectionLabel } from "@/components/ui";

export const dynamic = "force-dynamic";

/** How far the capacity calendar can browse either side of this month. */
const CAPACITY_MONTHS = 12;

/** Shift a "YYYY-MM" month by delta months. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tab, month: monthParam } = await searchParams;
  const today = istToday();
  // Capacity calendar month (?month=YYYY-MM), clamped to a year either way.
  const currentMonth = today.slice(0, 7);
  const minMonth = shiftMonth(currentMonth, -CAPACITY_MONTHS);
  const maxMonth = shiftMonth(currentMonth, CAPACITY_MONTHS);
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") && monthParam! >= minMonth && monthParam! <= maxMonth
    ? monthParam!
    : currentMonth;
  // Past days show what was done, so fetch logs back to the 1st of the month
  // (and never less than the overdue window today's load needs).
  const logDays = Math.max(CHORE_LOG_DAYS, daysBetween(today, `${month}-01`) + 1);

  const [items, settings, chores, choreLogs, choreMoves, capacity] = await Promise.all([
    getItems(), getRepository().getSettings(), getChores(),
    getChoreLogs(logDays), getChoreMoves(), getChoreCapacity(),
  ]);
  const activeItems = items.filter((i) => i.active);
  const pausedItems = items.filter((i) => !i.active);
  // A chore whose scheduled resume date has arrived is active even though its
  // stored flag is still off (nothing flips it), so split by isActiveOn.
  const activeChores = chores.filter((c) => isActiveOn(c, today));
  const pausedChores = chores.filter((c) => !isActiveOn(c, today));

  const promptValue = (settings["summary_prompt"] ?? "").trim() || DEFAULT_GUIDANCE;
  const tRaw = Number(settings["summary_temperature"]);
  const temperatureValue = Number.isFinite(tRaw) && tRaw >= 0 && tRaw <= 2 ? tRaw : DEFAULT_TEMPERATURE;

  const supplementsTab = (
    <>
      <details className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ➕ Add {T.label.toLowerCase()}
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <ItemForm action={addItem} submitLabel={`Add ${T.label.toLowerCase()}`} />
        </div>
      </details>

      <details className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ✨ Daily summary prompt
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <SummaryPromptEditor
            initialPrompt={promptValue}
            initialTemperature={temperatureValue}
            defaultPrompt={DEFAULT_GUIDANCE}
            defaultTemperature={DEFAULT_TEMPERATURE}
          />
        </div>
      </details>

      {activeItems.length > 0 && (
        <>
          <SectionLabel>Active</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {activeItems.map((i) => <ItemRow key={i.id} item={i} />)}
          </div>
        </>
      )}

      {pausedItems.length > 0 && (
        <>
          <SectionLabel>Paused</SectionLabel>
          <div className="flex flex-col gap-2.5">
            {pausedItems.map((i) => <ItemRow key={i.id} item={i} />)}
          </div>
        </>
      )}

      {items.length === 0 && (
        <div className="mt-8 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-muted)]">
          No {T.labelPlural.toLowerCase()} yet. Add your first one above.
        </div>
      )}
    </>
  );

  const monthHref = (m: string) => `/manage?tab=chores&month=${m}`;
  const prevMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const choresTab = (
    <>
      <CapacitySetting capacity={capacity} />
      <CapacityMonth month={month} today={today} chores={chores} logs={choreLogs} moves={choreMoves}
        capacity={capacity}
        prevHref={prevMonth >= minMonth ? monthHref(prevMonth) : null}
        nextHref={nextMonth <= maxMonth ? monthHref(nextMonth) : null} />

      <details className="mb-2 mt-4 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
        <summary className="cursor-pointer list-none px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
          ➕ Add chore
        </summary>
        <div className="border-t border-[var(--c-border)] p-4">
          <ChoreForm action={addChore} submitLabel="Add chore" capacity={capacity} />
        </div>
      </details>

      {chores.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-6 text-center text-[14px] text-[var(--c-muted)]">
          No chores yet. Add your first one above.
        </div>
      ) : (
        // The calendar is the main view now; the full list folds away below it.
        <details className="group mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <summary className="flex cursor-pointer list-none items-center px-4 py-3.5 text-[14px] font-medium text-[var(--c-text)]">
            <span className="flex-1">🧹 Chores ({chores.length})</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
              className="shrink-0 text-[var(--c-accent)] transition-transform group-open:rotate-180">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </summary>
          <div className="border-t border-[var(--c-border)] p-3">
            {activeChores.length > 0 && (
              <>
                <SectionLabel>Active</SectionLabel>
                <div className="flex flex-col gap-2.5">
                  {activeChores.map((c) => <ChoreRow key={c.id} chore={c} active capacity={capacity} />)}
                </div>
              </>
            )}

            {pausedChores.length > 0 && (
              <>
                <SectionLabel>Paused</SectionLabel>
                <div className="flex flex-col gap-2.5">
                  {pausedChores.map((c) => <ChoreRow key={c.id} chore={c} active={false} capacity={capacity} />)}
                </div>
              </>
            )}
          </div>
        </details>
      )}
    </>
  );

  return (
    <>
      <header className="pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">🗂️ All tasks</h1>
        <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">
          {activeItems.length} {T.labelPlural.toLowerCase()} · {activeChores.length} chores active
        </p>
      </header>

      {/* Keyed by ?tab so following an "All tasks →" link re-opens the right tab. */}
      <Tabs key={tab ?? ""} initialKey={tab}
        tabs={[
          { key: "supplements", label: `${T.icon} ${T.labelPlural}`, content: supplementsTab },
          { key: "chores", label: "🧹 Chores", content: choresTab },
        ]}
      />
    </>
  );
}
