# Tracker

A private, single-user, mobile-first supplement tracker — installable PWA, Google sign-in, Google Sheets as the data store, with Telegram reminders and a daily AI digest.

## Stack
- **Next.js 16 (App Router) + TypeScript**, Tailwind CSS
- **Auth.js (NextAuth v5)** — Google OIDC, locked to one email
- **Google Sheets** via `google-spreadsheet` (server-side service account)
- Deployed on **Vercel** (root directory: `web`)

## Architecture
- **`lib/core/`** — tracker-agnostic domain: `TrackableItem` / `LogEntry` types and the scheduling/streak/**day-based compliance** logic. Reused everywhere (UI, reminders).
- **`lib/repository/`** — the single data seam. `TrackerRepository` interface; `SheetsRepository` backs it now, `MemoryRepository` for dev/tests, chosen in `index.ts`. UI/logic never import Sheets directly, so a future Postgres/Supabase swap is one file.
- **`lib/trackers/`** — a `TrackerDefinition` per tracker (supplements today; habits later drop in as config, no new plumbing).
- **`lib/data.ts`** — cached read layer (`unstable_cache`, ~30s, tag-invalidated by mutations).
- **`actions/`** — auth-guarded, zod-validated server actions.
- **`app/(app)/`** — Today / Manage / Trends behind an auth gate + fixed bottom nav.

## Local development
```bash
cp .env.example .env.local   # fill in values (or use the dev shortcuts below)
npm install
npm run dev                  # http://localhost:3000
```
For UI work without Google/Sheets, set `REPOSITORY=memory` and `AUTH_DEV_BYPASS=1` in `.env.local` (both ignored when `NODE_ENV=production`).

## Deploy (Vercel)
1. Import the repo; **Root Directory = `web`**.
2. Add every variable from `.env.example` (real values) in Project → Settings → Environment Variables.
3. Add the production OAuth redirect URI in Google Cloud: `https://<domain>/api/auth/callback/google`.

## Reminders + daily digest (in-app, via Telegram)
`/api/cron/reminders` runs one of three actions, chosen by the current IST hour, so a **single** daily cron covers everything. Protected by `CRON_SECRET` (header `Authorization: Bearer <CRON_SECRET>`).

| IST time | Action | What it sends |
|----------|--------|---------------|
| ~08:00 | `summary` | Builds the day-based compliance digest, calls Groq (`GROQ_API_KEY`) for the nudge/trend, saves it to the `ai_summary` sheet (so the Today page insight refreshes), and Telegrams it. |
| ~13:00 | `lunch` | Reminds **Morning + Afternoon** supplements still pending. |
| ~20:00 | `evening` | Reminds **everything** still pending (any time of day). |

Point one free pinger (e.g. cron-job.org, timezone Asia/Kolkata) at the endpoint on cron `0 8,13,20 * * *`. Force an action for testing with `?do=summary|lunch|evening`.

The digest is **in-app** now — the legacy `digest.gs` Apps Script is retired (disable its time trigger to avoid duplicate summaries).

## Security
Security headers + CSP in `next.config.ts`; `noindex` + `robots.ts` (private app); auth on every mutation; zod validation; secrets server-only.
