export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 mt-6 text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--c-muted)] first:mt-0">
      {children}
    </p>
  );
}

export function CheckCircle({ filled }: { filled?: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11"
        fill={filled ? "var(--c-done)" : "transparent"}
        stroke={filled ? "var(--c-done)" : "var(--c-border)"} strokeWidth="2" />
      {filled && (
        <path d="M7 12.5l3.2 3.2L17 9" stroke="#04130c" strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Accent stripe color by time of day. */
export function todColor(tod: string): string {
  switch (tod) {
    case "Morning": return "#fbbf24";
    case "Afternoon": return "#60a5fa";
    case "Evening": return "#a78bfa";
    default: return "#6b7280";
  }
}
