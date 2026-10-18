"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveChore } from "@/actions/chores";
import { capacityLevel } from "@/lib/chores/logic";
import { capacityColor } from "./ui";
import type { CapacityDay, CapacityEntry, LastMove } from "./capacity-calendar";

const LEVEL_LABEL = ["Nothing planned", "Comfortable", "Busy", "Over capacity"] as const;
const inputCls =
  "min-w-0 flex-1 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]";
const primaryBtn =
  "rounded-xl bg-[var(--c-accent-strong)] px-3 py-2 text-[12px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.98] disabled:opacity-40";
const ghostBtn =
  "rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[12px] text-[var(--c-text)] transition active:scale-[0.98] disabled:opacity-40";

/** "Mon 19 Oct". */
export function shortDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Contents of a calendar day's popup: the total against capacity and the chores
 * behind it. Past days are read-only; today's and future chores can be moved,
 * with the lightest nearby day offered (inline when the day is over capacity).
 */
export default function CapacityDayPopup({
  day, today, capacity, upcoming, lastMove, onMoved, onUndo, undoPending, undoError,
}: {
  day: CapacityDay;
  today: string;
  capacity: number;
  upcoming: Record<string, number>;
  lastMove: LastMove | null;
  onMoved: (move: LastMove) => void;
  onUndo: () => void;
  undoPending: boolean;
  undoError: string | null;
}) {
  const past = day.iso < today;
  const { text } = capacityColor(day.level);

  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-[var(--c-text)]">
          {shortDate(day.iso)}{day.iso === today && <span className="ml-1.5 text-[12px] font-medium text-[var(--c-accent)]">today</span>}
        </h3>
        <span className="text-[15px] font-semibold tabular-nums" style={{ color: day.level ? text : "var(--c-muted)" }}>
          {day.load} / {capacity}
        </span>
      </div>
      <p className="mb-3 text-[12px] text-[var(--c-muted)]">
        {past ? "Completed that day" : LEVEL_LABEL[day.level]}
      </p>

      {lastMove && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-[var(--c-accent-soft)] px-3 py-2 text-[12px] text-[var(--c-text)]">
          <span className="min-w-0 flex-1 truncate">Moved {lastMove.name} to {shortDate(lastMove.to)}</span>
          <button type="button" onClick={onUndo} disabled={undoPending}
            className="shrink-0 font-semibold text-[var(--c-accent)] disabled:opacity-40">Undo</button>
        </div>
      )}
      {undoError && <p className="mb-2 text-[12px] text-[#fca5a5]">{undoError}</p>}

      {day.entries.length === 0 ? (
        <p className="rounded-xl bg-[var(--c-surface-2)] px-3 py-3 text-center text-[13px] text-[var(--c-muted)]">
          {past ? "Nothing done this day." : "No chores this day."}
        </p>
      ) : (
        <div className="flex max-h-[55dvh] flex-col gap-2 overflow-y-auto">
          {day.entries.map((e) => (
            <EntryRow key={e.choreId} entry={e} dayISO={day.iso} today={today} capacity={capacity} upcoming={upcoming}
              over={day.level === 3} readOnly={past} onMoved={onMoved} />
          ))}
        </div>
      )}
    </>
  );
}

function EntryRow({
  entry, dayISO, today, capacity, upcoming, over, readOnly, onMoved,
}: {
  entry: CapacityEntry;
  dayISO: string;
  today: string;
  capacity: number;
  upcoming: Record<string, number>;
  over: boolean;
  readOnly: boolean;
  onMoved: (move: LastMove) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const movable = !readOnly && !entry.done && entry.fromDates.length > 0;
  const s = entry.suggestion;
  // Loads are shown as they'd be AFTER the move (matches Home's reschedule popup).
  const sAfter = s ? s.load + entry.points : 0;
  const pickedAfter = date && date !== dayISO && upcoming[date] !== undefined
    ? upcoming[date] + (entry.alreadyOn?.includes(date) ? 0 : entry.points)
    : null;

  function move(to: string) {
    if (!to) { setError("Pick a date"); return; }
    if (to < today) { setError("Pick today or a future date"); return; }
    if (to === dayISO) { setError("It's already on this day"); return; }
    startTransition(async () => {
      setError(null);
      const res = await moveChore(entry.choreId, entry.fromDates, to);
      if (!res.ok) { setError(res.error); return; }
      onMoved({ choreId: entry.choreId, name: entry.name, to, previous: res.previous });
      router.refresh();
    });
  }

  const note = entry.done && !readOnly ? "✓ done today"
    : entry.overdueSince ? `overdue since ${shortDate(entry.overdueSince)}`
    : entry.movedFrom ? `moved from ${shortDate(entry.movedFrom)}`
    : null;

  return (
    <div className={`rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 ${pending ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-[var(--c-text)]">{entry.name}</div>
          {note && <div className="truncate text-[11px] text-[var(--c-muted)]">{note}</div>}
        </div>
        <span className="shrink-0 text-[12px] font-medium tabular-nums text-[var(--c-muted)]">{entry.points} pts</span>
        {movable && (
          <button type="button" onClick={() => { setPicking((p) => !p); setError(null); }} disabled={pending}
            aria-expanded={picking} className={`${ghostBtn} shrink-0 py-1.5`}>
            Move…
          </button>
        )}
      </div>

      {/* Over capacity: the lightest day is a one-tap fix, shown without opening the picker. */}
      {movable && over && s && !picking && (
        <button type="button" onClick={() => move(s.date)} disabled={pending} className={`${primaryBtn} mt-2 w-full`}>
          Move → {shortDate(s.date)} ({sAfter}/{capacity})
        </button>
      )}

      {movable && picking && (
        <div className="mt-2 flex flex-col gap-2">
          {s && (
            <button type="button" onClick={() => move(s.date)} disabled={pending} className={`${primaryBtn} w-full`}>
              Lightest: {shortDate(s.date)} ({sAfter}/{capacity})
            </button>
          )}
          <div className="flex gap-2">
            <input type="date" min={today} value={date} aria-label={`Move ${entry.name} to`}
              onChange={(e) => setDate(e.target.value)} className={inputCls} />
            <button type="button" onClick={() => move(date)} disabled={pending} className={ghostBtn}>Move</button>
          </div>
          {pickedAfter !== null && (
            <p className="text-[11px] text-[var(--c-muted)]">
              {shortDate(date)} becomes{" "}
              <span className="font-semibold tabular-nums"
                style={{ color: capacityColor(capacityLevel(pickedAfter, capacity)).text }}>
                {pickedAfter}/{capacity}
              </span>
            </p>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[12px] text-[#fca5a5]">{error}</p>}
    </div>
  );
}
