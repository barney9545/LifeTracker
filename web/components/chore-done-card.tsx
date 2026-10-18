"use client";

import { useState, useTransition } from "react";
import { undoChoreDone } from "@/actions/chores";
import { CheckCircle } from "./ui";

/** A chore marked done today, with Undo (chores are day-only, so no time input). */
export default function ChoreDoneCard({
  logId, name, detail,
}: {
  logId: string;
  name: string;
  detail: string;
}) {
  const [undone, setUndone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUndo() {
    if (undone || pending || !logId) return;
    setUndone(true); // optimistic
    startTransition(async () => {
      try {
        await undoChoreDone(logId);
      } catch {
        setUndone(false); // revert on failure
      }
    });
  }

  if (undone) return null; // the revalidated page puts it back under Overdue / Today

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 opacity-65">
      <CheckCircle filled />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-[var(--c-text)] line-through decoration-[var(--c-muted)]">{name}</span>
        <p className="truncate text-[12px] text-[var(--c-muted)]">{detail}</p>
      </div>
      <button onClick={handleUndo} disabled={pending || !logId}
        aria-label={`Undo ${name}`}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--c-accent)] transition active:scale-90">
        Undo
      </button>
    </div>
  );
}
