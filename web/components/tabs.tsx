"use client";

import { useState } from "react";

/**
 * A minimal client-side tab switcher. Each tab's content is pre-rendered on the
 * server and passed as children; only visibility toggles on the client.
 */
export default function Tabs({
  tabs,
  initialKey,
}: {
  tabs: { key: string; label: string; content: React.ReactNode }[];
  /** Tab to open first (e.g. from a `?tab=` param); falls back to the first tab. */
  initialKey?: string;
}) {
  const [active, setActive] = useState(
    tabs.some((t) => t.key === initialKey) ? initialKey! : (tabs[0]?.key ?? ""),
  );

  return (
    <>
      <div className="mb-4 flex gap-1.5 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActive(t.key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
              active === t.key
                ? "bg-[var(--c-accent-strong)] text-[var(--c-accent-ink)]"
                : "text-[var(--c-muted)]"
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </>
  );
}
