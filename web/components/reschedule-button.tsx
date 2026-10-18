"use client";

import { useRef, useState, useTransition } from "react";
import { moveChore } from "@/actions/chores";
import { addDaysISO, capacityLevel } from "@/lib/chores/logic";
import type { ChoreMove } from "@/lib/chores/types";
import { capacityColor } from "./ui";
import { RESCHEDULE_DAYS, shortDay, type ChoreItem } from "./reschedule-data";

const rowBtn =
  "flex w-full items-center gap-3 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5 text-left transition active:scale-[0.98] disabled:opacity-40";
const inputCls =
  "min-w-0 flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-text)] outline-none [color-scheme:dark] focus:border-[var(--c-accent)]";
const primaryBtn =
  "shrink-0 rounded-xl bg-[var(--c-accent-strong)] px-3 py-2 text-[13px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.98] disabled:opacity-40";

/** A day's load after the move, coloured like the capacity calendar. */
function LoadChip({ load, capacity }: { load: number | undefined; capacity: number }) {
  if (load === undefined) return null;
  const c = capacityColor(capacityLevel(load, capacity));
  return (
    <span className="shrink-0 rounded-full px-2 py-0.5 text-[12px] font-semibold tabular-nums"
      style={{ background: c.bg, color: c.text }}>
      {load}/{capacity}
    </span>
  );
}

/**
 * Reschedule-once for a Home chore card (like Google Tasks): Tomorrow, the
 * lightest day, or a picked date — each showing that day's load after the move.
 * Only this occurrence (or every missed day of an overdue chore) moves; the
 * repeating schedule is untouched. Native <dialog>, same pattern as PopupButton.
 */
export default function RescheduleButton({
  item, today, capacity, onMoved,
}: {
  item: ChoreItem;
  today: string;
  capacity: number;
  /** Called after a successful move with the chore's previous moves (for undo). */
  onMoved: (to: string, previous: ChoreMove[]) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tomorrow = addDaysISO(today, 1);
  const missed = item.fromDates.filter((d) => d < today).length;

  function open() {
    setPicked("");
    setError(null);
    ref.current?.showModal();
  }

  function move(to: string) {
    if (pending || !to) return;
    setError(null);
    startTransition(async () => {
      try {
        const r = await moveChore(item.id, item.fromDates, to);
        if (!r.ok) { setError(r.error); return; }
        ref.current?.close();
        onMoved(to, r.previous);
      } catch {
        setError("Couldn't move it — try again");
      }
    });
  }

  return (
    <>
      <button type="button" onClick={open} aria-label={`Reschedule ${item.name}`}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)] transition active:scale-90">
        <RescheduleIcon />
      </button>
      <dialog ref={ref} aria-label={`Reschedule ${item.name}`}
        // A click whose target is the <dialog> itself landed on the backdrop.
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="m-auto w-[min(360px,calc(100vw-32px))] rounded-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-0 text-[var(--c-text)] backdrop:bg-black/60 backdrop:backdrop-blur-sm">
        <div className="p-4">
          <p className="text-[15px] font-semibold">Reschedule {item.name}</p>
          <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">
            {missed > 1 ? `All ${missed} missed days move together` : "Just this once"}
            {" · "}load shown is that day after the move
          </p>

          <div className="mt-3 flex flex-col gap-2">
            <button type="button" onClick={() => move(tomorrow)} disabled={pending} className={rowBtn}>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">Tomorrow</span>
                <span className="block text-[12px] text-[var(--c-muted)]">{shortDay(tomorrow)}</span>
              </span>
              <LoadChip load={item.loads[tomorrow]} capacity={capacity} />
            </button>

            {item.lightest && item.lightest !== tomorrow && (
              <button type="button" onClick={() => move(item.lightest!)} disabled={pending} className={rowBtn}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium">Lightest day</span>
                  <span className="block text-[12px] text-[var(--c-muted)]">{shortDay(item.lightest)}</span>
                </span>
                <LoadChip load={item.loads[item.lightest]} capacity={capacity} />
              </button>
            )}

            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className="flex-1 text-[14px] font-medium">Pick a date</span>
                {picked && <LoadChip load={item.loads[picked]} capacity={capacity} />}
              </div>
              <div className="mt-2 flex gap-2">
                <input type="date" aria-label="Reschedule date" value={picked}
                  min={tomorrow} max={addDaysISO(today, RESCHEDULE_DAYS)}
                  onChange={(e) => setPicked(e.target.value)} className={inputCls} />
                <button type="button" onClick={() => move(picked)} disabled={pending || !picked} className={primaryBtn}>
                  Move
                </button>
              </div>
            </div>
          </div>

          {error && <p className="mt-2 text-[12px] text-[#f87171]">{error}</p>}

          <button type="button" onClick={() => ref.current?.close()}
            className="mt-3 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[13px] font-medium text-[var(--c-text)] transition active:scale-[0.98]">
            {pending ? "Moving…" : "Cancel"}
          </button>
        </div>
      </dialog>
    </>
  );
}

/** Calendar with a forward arrow — "move to another day", clearly not a done check. */
function RescheduleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11V6.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h6" />
      <path d="M3 9.5h17" /><path d="M8 3v3" /><path d="M15 3v3" />
      <path d="M15 17.5h6" /><path d="M18.5 15l2.5 2.5-2.5 2.5" />
    </svg>
  );
}
