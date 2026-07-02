"use client";

import { useState, useTransition } from "react";
import { logForDay } from "@/actions/items";
import DoneCard from "./done-card";

/**
 * A supplement that was DUE on a past day but not logged. "Mark taken" logs it
 * retrospectively for that day and hands off to DoneCard (editable time + Undo),
 * mirroring the DueCard → DoneCard handoff on the Today page.
 */
export default function MissedCard({
  id, name, detail, dateISO,
}: {
  id: string;
  name: string;
  detail: string;
  dateISO: string;
}) {
  const [pending, startTransition] = useTransition();
  const [logId, setLogId] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);

  function handleMark() {
    if (pending || logId || marked) return;
    setMarked(true); // optimistic + guards double-mark during the transition
    startTransition(async () => {
      try {
        setLogId(await logForDay(id, name, dateISO));
      } catch {
        setMarked(false); // revert on failure
      }
    });
  }

  if (logId) {
    return <DoneCard logId={logId} name={name} detail={detail} time="" />;
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 transition ${marked ? "opacity-50" : ""}`}>
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: "#f87171" }} />
      <div className="min-w-0 flex-1">
        <span className="truncate text-[15px] font-medium text-[#f87171]">{name}</span>
        <p className="mt-0.5 truncate text-[12px] text-[var(--c-muted)]">{detail}</p>
      </div>
      <button onClick={handleMark} disabled={pending || marked}
        aria-label={`Mark ${name} taken on ${dateISO}`}
        className="shrink-0 rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-1.5 text-[12px] font-medium text-[var(--c-text)] transition active:scale-90 disabled:opacity-40">
        Mark taken
      </button>
    </div>
  );
}
