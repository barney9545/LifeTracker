"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ChoreMove } from "@/lib/chores/types";
import { restoreChoreMoves } from "@/actions/chores";
import { capacityColor } from "./ui";
import CapacityDayPopup, { shortDate } from "./capacity-day-popup";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const navBtn =
  "flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[13px] text-[var(--c-text)] transition active:scale-90";

/** One chore on a calendar day, precomputed on the server (see CapacityMonth). */
export interface CapacityEntry {
  choreId: string;
  name: string;
  points: number;
  /** Completed (past days, or done today) — shown read-only. */
  done?: boolean;
  /** Original date when this occurrence was moved onto the day. */
  movedFrom?: string | null;
  /** Earliest missed day, when it's overdue today. */
  overdueSince?: string;
  /** What a Move hands to moveChore (empty when it can't be moved). */
  fromDates: string[];
  /** Lightest day to move it to; `load` is that day's load BEFORE the move. */
  suggestion?: { date: string; load: number } | null;
  /** Upcoming days it already falls on — moving there merges, so the load doesn't grow. */
  alreadyOn?: string[];
}

export interface CapacityDay {
  iso: string;
  day: number;
  load: number;
  level: 0 | 1 | 2 | 3;
  entries: CapacityEntry[];
}

/** The last move made from the popup, kept so it can be undone. */
export interface LastMove {
  choreId: string;
  name: string;
  to: string;
  previous: ChoreMove[];
}

/**
 * Month grid of daily chore load, coloured green / amber / red against the daily
 * capacity. Tapping a day opens its chores in a popup, where today's and future
 * chores can be moved (with undo). Month navigation is plain links (?month=).
 */
export default function CapacityCalendar({
  title, today, capacity, days, upcoming, leadingBlanks, prevHref, nextHref,
}: {
  title: string;
  today: string;
  capacity: number;
  days: CapacityDay[];
  /** Current load of each day from today on, for previewing a move. */
  upcoming: Record<string, number>;
  leadingBlanks: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openISO, setOpenISO] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const openDay = days.find((d) => d.iso === openISO) ?? null;

  function open(iso: string) {
    setOpenISO(iso);
    dialogRef.current?.showModal();
  }

  function undo() {
    if (!lastMove) return;
    startTransition(async () => {
      setUndoError(null);
      const res = await restoreChoreMoves(lastMove.choreId, lastMove.previous);
      if (!res.ok) { setUndoError(res.error ?? "Couldn't undo"); return; }
      setLastMove(null);
      router.refresh();
    });
  }

  const cells: (CapacityDay | null)[] = [...Array<null>(leadingBlanks).fill(null), ...days];

  return (
    <div className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        {prevHref ? (
          <Link href={prevHref} scroll={false} aria-label="Previous month" className={navBtn}>◀</Link>
        ) : (
          <span aria-hidden className={`${navBtn} opacity-30`}>◀</span>
        )}
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--c-text)]">{title}</h2>
        {nextHref ? (
          <Link href={nextHref} scroll={false} aria-label="Next month" className={navBtn}>▶</Link>
        ) : (
          <span aria-hidden className={`${navBtn} opacity-30`}>▶</span>
        )}
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[10px] font-medium text-[var(--c-muted)]">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          if (c === null) return <div key={`b${i}`} />;
          const { bg, text } = capacityColor(c.level);
          const isToday = c.iso === today;
          // Planned (future) days get a dashed edge; past and today are solid.
          const edge = c.iso > today ? "border-dashed" : "";
          return (
            <button key={c.iso} type="button" onClick={() => open(c.iso)}
              aria-label={`${shortDate(c.iso)}: ${c.load} of ${capacity} points`}
              className={`relative flex aspect-square items-center justify-center rounded-lg border border-[var(--c-border)] transition active:scale-90 ${edge} ${
                isToday ? "outline-2 outline-offset-1 outline-[color:var(--c-accent)]" : ""
              }`}
              style={{ background: bg }}>
              <span className={`absolute left-1 top-0.5 text-[9px] leading-none ${
                isToday ? "font-bold text-[var(--c-accent)]" : "text-[var(--c-muted)]"
              }`}>
                {c.day}
              </span>
              {c.load > 0 && (
                <span className="mt-1.5 text-[14px] font-semibold tabular-nums" style={{ color: text }}>{c.load}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--c-muted)]">
        {([[1, "comfortable"], [2, "busy"], [3, "over"]] as const).map(([lvl, label]) => (
          <span key={lvl} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[var(--c-border)]"
              style={{ background: capacityColor(lvl).bg }} />
            {label}
          </span>
        ))}
        <span className="ml-auto">tap a day</span>
      </div>

      {lastMove && openDay === null && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--c-accent-soft)] px-3 py-2 text-[12px] text-[var(--c-text)]">
          <span className="min-w-0 flex-1 truncate">Moved {lastMove.name} to {shortDate(lastMove.to)}</span>
          <button type="button" onClick={undo} disabled={pending}
            className="shrink-0 font-semibold text-[var(--c-accent)] disabled:opacity-40">Undo</button>
          <button type="button" onClick={() => setLastMove(null)} aria-label="Dismiss"
            className="shrink-0 text-[var(--c-muted)]">✕</button>
        </div>
      )}
      {undoError && openDay === null && <p className="mt-2 text-[12px] text-[#fca5a5]">{undoError}</p>}

      <dialog ref={dialogRef} aria-label={openDay ? shortDate(openDay.iso) : "Day"}
        onClose={() => setOpenISO(null)}
        // A click whose target is the <dialog> itself landed on the backdrop.
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="m-auto w-[min(360px,calc(100vw-32px))] rounded-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-0 text-[var(--c-text)] backdrop:bg-black/60 backdrop:backdrop-blur-sm">
        <div className="p-4">
          {openDay && (
            // Keyed by day so the move pickers reset when another day is opened.
            <CapacityDayPopup key={openDay.iso} day={openDay} today={today} capacity={capacity} upcoming={upcoming}
              lastMove={lastMove} onMoved={setLastMove} onUndo={undo} undoPending={pending} undoError={undoError} />
          )}
          <button type="button" onClick={() => dialogRef.current?.close()}
            className="mt-3 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[13px] font-medium text-[var(--c-text)] transition active:scale-[0.98]">
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
}
