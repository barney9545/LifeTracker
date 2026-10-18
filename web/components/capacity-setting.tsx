"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setChoreCapacity } from "@/actions/chores";

/** "Daily capacity: 100 ✎" — tap to edit the points a day can hold. */
export default function CapacitySetting({ capacity }: { capacity: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(capacity));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    startTransition(async () => {
      setError(null);
      const res = await setChoreCapacity(Number(value));
      if (!res.ok) { setError(res.error ?? "Something went wrong"); return; }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <button type="button" onClick={() => { setValue(String(capacity)); setEditing(true); }}
        aria-label={`Daily capacity ${capacity} points, edit`}
        className="mb-2 flex items-center gap-1.5 px-1 text-[12px] text-[var(--c-muted)] transition active:scale-[0.98]">
        Daily capacity:
        <span className="font-semibold tabular-nums text-[var(--c-text)]">{capacity}</span>
        <span className="text-[var(--c-accent)]" aria-hidden>✎</span>
      </button>
    );
  }

  return (
    <div className="mb-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex items-center gap-2">
        <label htmlFor="chore-capacity" className="shrink-0 text-[12px] text-[var(--c-muted)]">Daily capacity</label>
        <input id="chore-capacity" type="number" inputMode="numeric" min={1} max={1000} step={1} required autoFocus
          value={value} onChange={(e) => setValue(e.target.value)}
          className="w-20 min-w-0 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />
        <button type="submit" disabled={pending}
          className="rounded-xl bg-[var(--c-accent-strong)] px-3 py-2 text-[12px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.98] disabled:opacity-40">
          Save
        </button>
        <button type="button" onClick={() => { setEditing(false); setError(null); }} disabled={pending}
          className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2 text-[12px] text-[var(--c-text)] transition active:scale-[0.98] disabled:opacity-40">
          Cancel
        </button>
      </form>
      {error && <p className="mt-2 text-[12px] text-[#fca5a5]">{error}</p>}
    </div>
  );
}
