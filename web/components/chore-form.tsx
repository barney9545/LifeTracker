"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Chore, ChoreFrequency } from "@/lib/chores/types";
import { MONTH_WEEKS, MONTH_WEEK_LABELS, WEEKDAYS, WEEKDAY_LABELS, weekOf } from "@/lib/chores/logic";
import { istToday } from "@/lib/core/logic";

const inputCls =
  "w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[14px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
const labelCls = "mb-1 block text-[12px] text-[var(--c-muted)]";
// A visually hidden checkbox/radio inside a label styled as a toggle chip.
const chipCls =
  "flex-1 cursor-pointer select-none rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] py-2.5 text-center text-[13px] font-medium text-[var(--c-muted)] transition active:scale-95 has-checked:border-[var(--c-accent-strong)] has-checked:bg-[var(--c-accent-strong)] has-checked:text-[var(--c-accent-ink)] has-focus-visible:ring-2 has-focus-visible:ring-[var(--c-accent)]";

export default function ChoreForm({
  action,
  chore,
  submitLabel,
  onDone,
}: {
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string } | void>;
  chore?: Chore;
  submitLabel: string;
  onDone?: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Tracked only to show/hide the A/B week / month pickers; the select itself stays uncontrolled.
  const [frequency, setFrequency] = useState<ChoreFrequency>(chore?.frequency ?? "weekly");
  const thisWeek = weekOf(istToday());
  const nextWeek = thisWeek === "A" ? "B" : "A";

  // Catch "no days" before submitting: a form action resets the fields, so a
  // server-side error here would wipe what was typed.
  function preCheck(e: React.FormEvent<HTMLFormElement>) {
    if (frequency !== "monthly" && new FormData(e.currentTarget).getAll("days").length === 0) {
      e.preventDefault();
      setError("Pick at least one day");
    }
  }

  async function handle(formData: FormData) {
    setError(null);
    const res = await action(formData);
    if (res && res.ok === false) {
      setError(res.error ?? "Something went wrong");
      return;
    }
    formRef.current?.reset();
    setFrequency(chore?.frequency ?? "weekly");
    onDone?.();
    router.refresh();
  }

  return (
    <form ref={formRef} action={handle} onSubmit={preCheck}
      onChange={() => { if (error) setError(null); }} className="flex flex-col gap-3">
      <div>
        <label className={labelCls}>Name *</label>
        <input name="name" required maxLength={80} defaultValue={chore?.name ?? ""} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Repeats</label>
        <select name="frequency" defaultValue={chore?.frequency ?? "weekly"}
          onChange={(e) => setFrequency(e.target.value as ChoreFrequency)} className={inputCls}>
          <option value="weekly">Weekly</option>
          <option value="biweekly">Every 2 weeks</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      {frequency === "monthly" ? (
        <div>
          <label className={labelCls}>On the</label>
          <div className="grid grid-cols-2 gap-3">
            <select name="month_week" aria-label="Which week of the month"
              defaultValue={String(chore?.monthWeek ?? 1)} className={inputCls}>
              {MONTH_WEEKS.map((w) => <option key={w} value={w}>{MONTH_WEEK_LABELS[w]}</option>)}
            </select>
            <select name="month_day" aria-label="Day of the week"
              defaultValue={String(chore?.days[0] ?? 1)} className={inputCls}>
              {WEEKDAYS.map((d) => <option key={d} value={d}>{WEEKDAY_LABELS[d]}</option>)}
            </select>
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--c-muted)]">of every month, e.g. 1st Mon or Last Fri.</p>
        </div>
      ) : (
        <fieldset>
          <legend className={labelCls}>Days *</legend>
          <div className="flex gap-1">
            {WEEKDAYS.map((d) => (
              <label key={d} className={`${chipCls} ${d > 5 ? "opacity-80" : ""}`}>
                <input type="checkbox" name="days" value={d} defaultChecked={chore?.days.includes(d)}
                  className="sr-only" />
                {WEEKDAY_LABELS[d]}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {frequency === "biweekly" && (
        <fieldset>
          <legend className={labelCls}>Which week</legend>
          <div className="flex gap-1.5">
            {(["A", "B"] as const).map((w) => (
              <label key={w} className={chipCls}>
                <input type="radio" name="week" value={w} defaultChecked={(chore?.week ?? "A") === w}
                  className="sr-only" />
                Week {w}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11px] text-[var(--c-muted)]">
            This week is week {thisWeek}, next week is {nextWeek}.
          </p>
        </fieldset>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <textarea name="notes" rows={2} maxLength={1000} defaultValue={chore?.notes ?? ""} className={inputCls} />
      </div>

      {error && (
        <p className="rounded-lg border border-[#f87171]/40 bg-[#f87171]/10 px-3 py-2 text-[12px] text-[#fca5a5]">
          {error}
        </p>
      )}

      <button type="submit"
        className="mt-1 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3 text-[14px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.99]">
        {submitLabel}
      </button>
    </form>
  );
}
