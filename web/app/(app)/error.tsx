"use client";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-4xl">⚠️</div>
      <h2 className="text-[18px] font-semibold text-[var(--c-text)]">Something went wrong</h2>
      <p className="mt-1 max-w-[280px] text-[13px] text-[var(--c-muted)]">
        Couldn&apos;t load your data — usually a temporary Google Sheets hiccup.
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-xl bg-[var(--c-accent-strong)] px-5 py-2.5 text-[14px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.99]"
      >
        Try again
      </button>
    </div>
  );
}
