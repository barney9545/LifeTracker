"use client";

import { useState, useTransition } from "react";
import { restoreChoreMoves } from "@/actions/chores";
import type { ChoreMove } from "@/lib/chores/types";
import { SectionLabel } from "./ui";
import ChoreDueCard from "./chore-due-card";
import RescheduleButton from "./reschedule-button";
import { shortDay, type ChoreItem } from "./reschedule-data";

type Section = "overdue" | "due";
interface Moved { item: ChoreItem; section: Section; index: number; to: string; previous: ChoreMove[] }

/**
 * The Overdue + Today sections of the Home chores panel. Client-side so a
 * rescheduled chore can stay in place as "Moved to … · Undo": the move
 * revalidates Home and the chore drops out of today's list, so the row is kept
 * here (at its old position) until it's undone or the page is left.
 */
export default function RescheduleList({
  overdue, due, today, capacity,
}: {
  overdue: ChoreItem[];
  due: ChoreItem[];
  today: string;
  capacity: number;
}) {
  const [moved, setMoved] = useState<Record<string, Moved>>({});

  function rows(items: ChoreItem[], section: Section) {
    const out = items.map((item) => ({ item, moved: moved[item.id] }));
    const gone = Object.values(moved)
      .filter((m) => m.section === section && !items.some((i) => i.id === m.item.id))
      .sort((a, b) => a.index - b.index);
    for (const m of gone) out.splice(Math.min(m.index, out.length), 0, { item: m.item, moved: m });
    return out.map(({ item, moved: m }) => m
      ? <MovedRow key={item.id} moved={m} onUndone={() => setMoved((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        })} />
      : (
        <ChoreDueCard key={item.id} id={item.id} name={item.name} detail={item.detail}
          overdueSince={item.overdueSince} movedFrom={item.movedFrom}
          reschedule={
            <RescheduleButton item={item} today={today} capacity={capacity}
              onMoved={(to, previous) => setMoved((prev) => ({
                ...prev,
                [item.id]: { item, section, index: items.findIndex((i) => i.id === item.id), to, previous },
              }))} />
          } />
      ));
  }

  const overdueRows = rows(overdue, "overdue");
  const dueRows = rows(due, "due");

  return (
    <>
      {overdueRows.length > 0 && (
        <>
          <SectionLabel>Overdue</SectionLabel>
          <div className="flex flex-col gap-2.5">{overdueRows}</div>
        </>
      )}
      {dueRows.length > 0 && (
        <>
          <SectionLabel>Today</SectionLabel>
          <div className="flex flex-col gap-2.5">{dueRows}</div>
        </>
      )}
    </>
  );
}

/** A just-rescheduled chore, kept in place with Undo (guards against misclicks). */
function MovedRow({ moved, onUndone }: { moved: Moved; onUndone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function handleUndo() {
    if (pending) return;
    setError(false);
    startTransition(async () => {
      try {
        const r = await restoreChoreMoves(moved.item.id, moved.previous);
        if (r.ok) onUndone(); // the revalidated page puts the chore back
        else setError(true);
      } catch {
        setError(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-3.5">
      <span className="h-9 w-1 shrink-0 rounded-full bg-[var(--c-border)]" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-[var(--c-muted)]">{moved.item.name}</span>
        <p className="truncate text-[12px] text-[var(--c-muted)]">
          {error ? "Couldn't undo — try again" : <>Moved to <span className="font-medium text-[var(--c-text)]">{shortDay(moved.to)}</span></>}
        </p>
      </div>
      <button onClick={handleUndo} disabled={pending}
        aria-label={`Undo reschedule of ${moved.item.name}`}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--c-accent)] transition active:scale-90 disabled:opacity-40">
        {pending ? "Undoing…" : "Undo"}
      </button>
    </div>
  );
}
