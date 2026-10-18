"use client";

import { useRef } from "react";

const GUIDE: [string, string][] = [
  ["5", "quick (under 10 min)"],
  ["15", "medium"],
  ["30", "heavy or draining"],
  ["50+", "big job, eats half the evening"],
];

/**
 * Small ⓘ button that opens the points guideline — the only place it appears.
 * Same native <dialog> pattern as PopupButton, sized to sit beside a form label.
 * Both buttons are type="button" so they never submit the surrounding form.
 */
export default function CapacityGuide({ capacity = 100 }: { capacity?: number }) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" aria-label="How many points?" onClick={() => ref.current?.showModal()}
        className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--c-accent)] transition active:scale-90">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5" /><path d="M12 7.5h.01" />
        </svg>
      </button>
      <dialog ref={ref} aria-label="Capacity points guide"
        // A click whose target is the <dialog> itself landed on the backdrop.
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="m-auto w-[min(360px,calc(100vw-32px))] rounded-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-0 text-[var(--c-text)] backdrop:bg-black/60 backdrop:backdrop-blur-sm">
        <div className="p-4">
          <h3 className="mb-2 text-[15px] font-semibold">How many points?</h3>
          <ul className="flex flex-col gap-1.5">
            {GUIDE.map(([pts, what]) => (
              <li key={pts} className="flex gap-3 text-[13px]">
                <span className="w-9 shrink-0 text-right font-semibold tabular-nums text-[var(--c-accent)]">{pts}</span>
                <span className="text-[var(--c-text)]">{what}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-[var(--c-muted)]">
            A day has {capacity} points; aim to stay under ~70%.
          </p>
          <button type="button" onClick={() => ref.current?.close()}
            className="mt-3 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[13px] font-medium text-[var(--c-text)] transition active:scale-[0.98]">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
