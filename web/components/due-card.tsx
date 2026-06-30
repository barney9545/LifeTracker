"use client";

import { useState, useTransition } from "react";
import { markDone } from "@/actions/items";
import { istNowHHMM } from "@/lib/core/logic";
import { CheckCircle } from "./ui";
import DoneCard from "./done-card";

export default function DueCard({
  id, name, detail, streak, dotColor,
}: {
  id: string;
  name: string;
  detail: string;
  streak?: string;
  dotColor: string;
}) {
  const [pending, startTransition] = useTransition();
  // Once marked, we hand off to DoneCard (editable time + undo) using the new log id.
  const [logId, setLogId] = useState<string | null>(null);
  const [markedTime, setMarkedTime] = useState("");

  function handleDone() {
    if (pending || logId) return;
    const time = istNowHHMM(); // client clock, already IST-correct
    setMarkedTime(time); // optimistic
    startTransition(async () => {
      try {
        setLogId(await markDone(id, name, time));
      } catch {
        setMarkedTime(""); // revert on failure
      }
    });
  }

  // After a successful mark, render the same card the "Done today" list uses, so the
  // time is immediately adjustable and the action is undoable.
  if (logId) {
    return <DoneCard logId={logId} name={name} detail={detail} time={markedTime} />;
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 transition ${markedTime ? "opacity-50" : ""}`}>
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: dotColor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-[15px] font-medium text-[var(--c-text)] ${markedTime ? "line-through" : ""}`}>
            {name}
          </span>
          {streak && <span className="shrink-0 text-[11px] text-[var(--c-accent)]">{streak}</span>}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--c-muted)]">{detail}</p>
      </div>
      <button onClick={handleDone} disabled={pending || !!markedTime}
        aria-label={`Mark ${name} done`}
        className="shrink-0 transition active:scale-90">
        <CheckCircle filled={!!markedTime} />
      </button>
    </div>
  );
}
