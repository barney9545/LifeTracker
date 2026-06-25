/**
 * Auth.js (NextAuth v5) — Google sign-in locked to a single allowed email.
 * The signIn callback rejects every other account, so any valid session is, by
 * construction, the authorised user.
 */
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_EMAIL = (process.env.ALLOWED_EMAIL ?? "").toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    signIn({ profile, user }) {
      const email = (profile?.email ?? user?.email ?? "").toLowerCase();
      return email.length > 0 && email === ALLOWED_EMAIL;
    },
  },
});

/**
 * Returns the current session, or a fake one when AUTH_DEV_BYPASS=1 (local
 * testing only — never set in production). Lets Playwright exercise the authed
 * screens without a real Google round-trip.
 */
export async function getSession() {
  const session = await auth();
  if (session?.user) return session;
  if (process.env.AUTH_DEV_BYPASS === "1" && process.env.NODE_ENV !== "production") {
    return { user: { name: "Dev", email: ALLOWED_EMAIL || "dev@example.com" } };
  }
  return null;
}
