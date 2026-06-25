"use client";

import { useState, useTransition } from "react";
import { markDone } from "@/actions/items";
import { CheckCircle } from "./ui";

export default function DueCard({
  id, name, detail, streak, dotColor,
}: {
  id: string;
  name: string;
  detail: string;
  streak?: string;
  dotColor: string;
}) {
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handle() {
    if (done || pending) return;
    setDone(true); // optimistic
    startTransition(async () => {
      try {
        await markDone(id, name);
      } catch {
        setDone(false); // revert on failure
      }
    });
  }

  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3.5 transition ${done ? "opacity-50" : ""}`}>
      <span className="h-9 w-1 shrink-0 rounded-full" style={{ background: dotColor }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`truncate text-[15px] font-medium text-[var(--c-text)] ${done ? "line-through" : ""}`}>
            {name}
          </span>
          {streak && <span className="shrink-0 text-[11px] text-[var(--c-accent)]">{streak}</span>}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[var(--c-muted)]">{detail}</p>
      </div>
      <button onClick={handle} disabled={done || pending}
        aria-label={`Mark ${name} done`}
        className="shrink-0 transition active:scale-90">
        <CheckCircle filled={done} />
      </button>
    </div>
  );
}
