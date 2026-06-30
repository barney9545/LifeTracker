import Link from "next/link";

export default function NotFound() {
  return (
    <div className="app-shell flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <div className="mb-3 text-4xl">🔍</div>
      <h2 className="text-[18px] font-semibold text-[var(--c-text)]">Page not found</h2>
      <Link
        href="/"
        className="mt-5 rounded-xl bg-[var(--c-accent-strong)] px-5 py-2.5 text-[14px] font-semibold text-[var(--c-accent-ink)]"
      >
        Back to Today
      </Link>
    </div>
  );
}
