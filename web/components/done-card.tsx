"use client";

import { useState, useTransition } from "react";
import { undoDone, updateLogTime } from "@/actions/items";
import { CheckCircle } from "./ui";

export default function DoneCard({
  logId, name, detail, time,
}: {
  logId: string;
  name: string;
  detail: string;
  time?: string;
}) {
  const [undone, setUndone] = useState(false);
  const [value, setValue] = useState(time ?? "");
  const [pending, startTransition] = useTransition();

  function handleUndo() {
    if (undone || pending || !logId) return;
    setUndone(true); // optimistic
    startTransition(async () => {
      try {
        await undoDone(logId);
      } catch {
        setUndone(false); // revert on failure
      }
    });
  }

  function handleTime(next: string) {
    if (!logId || !next || next === value) return;
    const prev = value;
    setValue(next); // optimistic
    startTransition(async () => {
      const res = await updateLogTime(logId, next);
      if (!res.ok) setValue(prev); // revert on failure
    });
  }

  if (undone) return null; // disappears immediately; reload moves it back to "Due now"

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 opacity-65">
      <CheckCircle filled />
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-medium text-[var(--c-text)] line-through decoration-[var(--c-muted)]">{name}</span>
        <p className="text-[12px] text-[var(--c-muted)]">{detail}</p>
      </div>
      {logId ? (
        <input
          type="time"
          value={value}
          disabled={pending}
          onChange={(e) => handleTime(e.target.value)}
          aria-label={`Time taken for ${name}`}
          className="shrink-0 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)] px-2 py-1 text-[12px] text-[var(--c-done)] outline-none focus:border-[var(--c-accent)]"
        />
      ) : (
        time && <span className="shrink-0 text-[12px] text-[var(--c-done)]">{time}</span>
      )}
      <button onClick={handleUndo} disabled={pending || !logId}
        aria-label={`Undo ${name}`}
        className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-[var(--c-accent)] transition active:scale-90">
        Undo
      </button>
    </div>
  );
}
