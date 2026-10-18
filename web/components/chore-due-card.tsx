"use client";

import { useState, useTransition } from "react";
import { markChoreDone } from "@/actions/chores";
import { CheckCircle } from "./ui";
import ChoreDoneCard from "./chore-done-card";

/** An outstanding chore (overdue or due today) with a one-tap check, like DueCard. */
export default function ChoreDueCard({
  id, name, detail, overdueSince, movedFrom, reschedule,
}: {
  id: string;
  name: string;
  detail: string;
  /** e.g. "Mon 19 Oct" when it was missed on an earlier day. */
  overdueSince?: string;
  /** e.g. "Mon 19 Oct" when today's occurrence was moved here from that day. */
  movedFrom?: string;
  /** Reschedule control, shown left of the check (hidden once marked). */
  reschedule?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  // Once marked, hand off to ChoreDoneCard (with undo) using the new log id.
  const [logId, setLogId] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);

  function handleDone() {
    if (pending || logId) return;
    setMarked(true); // optimistic
    startTransition(async () => {
      try {
        setLogId(await markChoreDone(id, name));
      } catch {
        setMarked(false); // revert on failure
      }
    });
  }

  if (logId) return <ChoreDoneCard logId={logId} name={name} detail={detail} />;

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 transition ${marked ? "opacity-50" : ""}`}>
      <span className="h-9 w-1 shrink-0 rounded-full"
        style={{ background: overdueSince ? "var(--c-due)" : "var(--c-accent)" }} />
      <div className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-medium text-[var(--c-text)] ${marked ? "line-through" : ""}`}>
          {name}
        </span>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          {overdueSince && (
            <span className="shrink-0 rounded-full bg-[var(--c-due)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--c-due)]">
              since {overdueSince}
            </span>
          )}
          {movedFrom && (
            <span className="shrink-0 rounded-full bg-[var(--c-accent-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--c-accent)]">
              moved from {movedFrom}
            </span>
          )}
          <span className="truncate text-[12px] text-[var(--c-muted)]">{detail}</span>
        </div>
      </div>
      {!marked && reschedule}
      <button onClick={handleDone} disabled={pending || marked}
        aria-label={`Mark ${name} done`}
        className="shrink-0 transition active:scale-90">
        <CheckCircle filled={marked} />
      </button>
    </div>
  );
}
