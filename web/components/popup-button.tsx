"use client";

import { useRef } from "react";

/**
 * A small round icon button that opens its (server-rendered) children in a
 * centred popup. Native <dialog>: Esc closes it, and so does a tap on the backdrop.
 */
export default function PopupButton({
  label, icon, children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button type="button" aria-label={label} onClick={() => ref.current?.showModal()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--c-accent)] transition active:scale-90">
        {icon}
      </button>
      <dialog ref={ref} aria-label={label}
        // A click whose target is the <dialog> itself landed on the backdrop.
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="m-auto w-[min(360px,calc(100vw-32px))] rounded-3xl border border-[var(--c-border)] bg-[var(--c-bg)] p-0 text-[var(--c-text)] backdrop:bg-black/60 backdrop:backdrop-blur-sm">
        <div className="p-4">
          {children}
          <button type="button" onClick={() => ref.current?.close()}
            className="mt-3 w-full rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2.5 text-[13px] font-medium text-[var(--c-text)] transition active:scale-[0.98]">
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}

export function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9.5" /><path d="M12 11v5.5" /><path d="M12 7.5h.01" />
    </svg>
  );
}

export function SparkleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11 3.5l1.7 4.6a3 3 0 0 0 1.8 1.8L19 11.5l-4.5 1.7a3 3 0 0 0-1.8 1.8L11 19.5l-1.7-4.5a3 3 0 0 0-1.8-1.8L3 11.5l4.5-1.6a3 3 0 0 0 1.8-1.8z" />
      <path d="M18.5 2.5l.6 1.5 1.4.5-1.4.6-.6 1.4-.5-1.4-1.5-.6 1.5-.5z" />
    </svg>
  );
}
