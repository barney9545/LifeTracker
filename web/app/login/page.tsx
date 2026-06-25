import { redirect } from "next/navigation";
import { getSession, signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  if (session?.user) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="app-shell flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-2 text-5xl">💊</div>
        <h1 className="text-2xl font-semibold text-[var(--c-text)]">Tracker</h1>
        <p className="mt-1 text-[14px] text-[var(--c-muted)]">
          Your personal health assistant
        </p>

        {error && (
          <p className="mx-auto mt-6 rounded-xl border border-[#f87171]/40 bg-[#f87171]/10 px-4 py-3 text-[13px] text-[#fca5a5]">
            🚫 That account isn&apos;t authorised. This app is private.
          </p>
        )}

        <p className="mx-auto mt-6 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-4 py-3 text-[13px] text-[var(--c-text)]">
          This app is private. Sign in with your Google account to continue.
        </p>

        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
          className="mt-4"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent-strong)] px-4 py-3.5 text-[15px] font-semibold text-[var(--c-accent-ink)] transition active:scale-[0.99]"
          >
            🔐 Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
