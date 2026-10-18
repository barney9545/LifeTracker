"use client";

import { useSyncExternalStore } from "react";

/*
 * Home panels work like drawers: at most one is open, and opening one closes
 * the other. Which one is open is remembered in localStorage when available.
 * An in-memory value is the source of truth for this session, so toggling still
 * works if storage is blocked; useSyncExternalStore renders the server default
 * during hydration, then the remembered value — no mismatch.
 */
const DEFAULT_OPEN = "supplements";
const STORAGE_KEY = "home:open-panel";
let memory: string | undefined;
const listeners = new Set<() => void>();

function readOpen(): string {
  if (memory !== undefined) return memory;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v !== null) return v;
  } catch { /* storage unavailable — fall through to the default */ }
  return DEFAULT_OPEN;
}

function writeOpen(id: string) {
  memory = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* session-only */ }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** The id of the open panel ("" when all are closed). */
function useOpenPanel(): string {
  return useSyncExternalStore(subscribe, readOpen, () => DEFAULT_OPEN);
}

/**
 * A minimisable section on the Home screen: a header row (title, a compact
 * summary that stays informative while collapsed, optional icon actions,
 * chevron) over server-rendered children. No inner scroll — the page scrolls.
 */
export default function CollapsiblePanel({
  id, title, summary, actions, children,
}: {
  /** Stable key; also the side-rail target. */
  id: string;
  title: string;
  summary: string;
  /** Icon buttons shown in the header (e.g. popups); they don't toggle the panel. */
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const open = useOpenPanel() === id;
  const bodyId = `panel-${id}`;

  return (
    <section id={`section-${id}`} className="mb-4 scroll-mt-4">
      <div className="relative flex items-center gap-1 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] py-2 pl-4 pr-3">
        {/* The whole header toggles; the action buttons sit above this layer. */}
        <button type="button" onClick={() => writeOpen(open ? "" : id)}
          aria-expanded={open} aria-controls={bodyId} aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
          className="absolute inset-0 rounded-2xl transition active:bg-[var(--c-accent-soft)]" />
        <span className="pointer-events-none relative text-[15px] font-semibold text-[var(--c-text)]">{title}</span>
        <span className="pointer-events-none relative min-w-0 flex-1 truncate pr-1 text-right text-[12px] font-medium text-[var(--c-muted)]">
          {summary}
        </span>
        {actions && <div className="relative flex items-center">{actions}</div>}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className={`pointer-events-none relative ml-1 shrink-0 text-[var(--c-accent)] transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
      <div id={bodyId} hidden={!open} className="pt-3">
        {children}
      </div>
    </section>
  );
}

/**
 * Vertical switcher pinned to the left edge while a panel is open: one tab per
 * panel, tap to open it (closing the other) and jump to its top. Hidden when
 * every panel is closed — the headers are all on screen then anyway.
 */
export function PanelRail({ panels }: { panels: { id: string; label: string }[] }) {
  const openId = useOpenPanel();
  if (!panels.some((p) => p.id === openId)) return null;

  function go(id: string) {
    writeOpen(id);
    // After the drawer swap renders, bring the newly opened section to the top.
    requestAnimationFrame(() =>
      document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }

  return (
    <nav aria-label="Switch section"
      className="fixed top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2 left-[max(0px,calc(50%-215px))]">
      {panels.map((p) => {
        const active = p.id === openId;
        return (
          <button key={p.id} type="button" onClick={() => go(p.id)} aria-current={active ? "true" : undefined}
            className={`flex w-[18px] items-center justify-center rounded-r-lg py-3 text-[11px] font-semibold tracking-wide transition active:scale-95 ${
              active
                ? "bg-[var(--c-accent-strong)] text-[var(--c-accent-ink)]"
                : "border border-l-0 border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-muted)]"
            }`}>
            <span className="rotate-180 [writing-mode:vertical-rl]">{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
