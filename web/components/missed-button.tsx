"use client";

import { useTransition } from "react";
import { markChoreMissed } from "@/actions/chores";

/**
 * "Mark missed" for an overdue Home chore: settles every missed day without
 * counting it as done (today's occurrence, if any, stays due). One tap — the
 * row then turns into "Marked missed · Undo", so a misclick is cheap to fix.
 */
export default function MissedButton({
  id, name, onMissed, onError,
}: {
  id: string;
  name: string;
  /** Called with the new log id (for undo) once it's saved. */
  onMissed: (logId: string) => void;
  onError: (message: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  function handleMissed() {
    if (pending) return;
    startTransition(async () => {
      try {
        const r = await markChoreMissed(id, name);
        if (r.ok) onMissed(r.logId);
        else onError(r.error);
      } catch {
        onError("Couldn't mark it missed — try again");
      }
    });
  }

  return (
    <button type="button" onClick={handleMissed} disabled={pending}
      aria-label={`Mark ${name} missed`} title="Mark missed"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-due)] transition active:scale-90 disabled:opacity-40">
      <MissedIcon />
    </button>
  );
}

/** A crossed-out circle — "skipped", clearly distinct from the done check. */
function MissedIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6" /><path d="M15 9l-6 6" />
    </svg>
  );
}
