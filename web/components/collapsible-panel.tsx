"use client";

import { useSyncExternalStore } from "react";

/*
 * Open/closed state per panel, remembered in localStorage when available.
 * An in-memory map is the source of truth for this session, so toggling still
 * works if storage is blocked; useSyncExternalStore renders the server default
 * (open) during hydration, then the remembered value — no mismatch.
 */
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();
const storageKey = (id: string) => `panel:${id}:open`;

function readOpen(id: string): boolean {
  const known = memory.get(id);
  if (known !== undefined) return known;
  try {
    const v = localStorage.getItem(storageKey(id));
    if (v !== null) return v === "1";
  } catch { /* storage unavailable — fall through to the default */ }
  return true;
}

function writeOpen(id: string, open: boolean) {
  memory.set(id, open);
  try { localStorage.setItem(storageKey(id), open ? "1" : "0"); } catch { /* session-only */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * A minimisable section on the Home screen: a header row (title, a compact
 * summary that stays informative while collapsed, chevron) over server-rendered
 * children. No inner scroll — the page scrolls; the body just shows or hides.
 */
export default function CollapsiblePanel({
  id, title, summary, children,
}: {
  /** Stable key for remembering the open state. */
  id: string;
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  const open = useSyncExternalStore(subscribe, () => readOpen(id), () => true);
  const bodyId = `panel-${id}`;

  return (
    <section className="mb-6">
      <button type="button" onClick={() => writeOpen(id, !open)}
        aria-expanded={open} aria-controls={bodyId}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 text-left transition active:scale-[0.99]">
        <span className="text-[15px] font-semibold text-[var(--c-text)]">{title}</span>
        <span className="min-w-0 flex-1 truncate text-right text-[12px] text-[var(--c-muted)]">{summary}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={`shrink-0 text-[var(--c-accent)] transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={bodyId} hidden={!open} className="pt-3">
        {children}
      </div>
    </section>
  );
}
