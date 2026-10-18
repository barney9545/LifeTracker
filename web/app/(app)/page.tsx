import Link from "next/link";
import { istHour } from "@/lib/core/logic";
import SupplementsToday from "@/components/supplements-today";
import ChoresToday from "@/components/chores-today";

export const dynamic = "force-dynamic";

function greeting(): string {
  const h = istHour();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Home: one screen with a minimisable panel per tracker. */
export default function TodayPage() {
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "short",
  });

  return (
    <>
      <header className="flex items-center justify-between pb-5">
        <div>
          <p className="text-[13px] text-[var(--c-muted)]">{greeting()}</p>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--c-text)]">{dateLabel}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/calendar" aria-label="Open calendar"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-accent)] transition active:scale-90">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="16" rx="2" />
              <path d="M3 9h18" /><path d="M8 3v3" /><path d="M16 3v3" />
            </svg>
          </Link>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-accent-soft)] text-[15px] font-semibold text-[var(--c-accent)]">
            D
          </div>
        </div>
      </header>

      <SupplementsToday />
      <ChoresToday />
    </>
  );
}
