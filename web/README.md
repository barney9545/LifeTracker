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

## Reminders (in-app, via Telegram)
`/api/cron/reminders?slot=morning|afternoon|evening|pending` computes what's due-and-not-taken (reusing `lib/core` logic) and sends one Telegram message. Protected by `CRON_SECRET`. Scheduled by `vercel.json` crons (IST times expressed in UTC). If the hosting tier limits cron jobs, point a free pinger (e.g. cron-job.org) at the same four URLs with header `Authorization: Bearer <CRON_SECRET>`.

The daily AI digest currently lives in Google Apps Script (`digest.gs`), reading/writing the same sheet.

## Security
Security headers + CSP in `next.config.ts`; `noindex` + `robots.ts` (private app); auth on every mutation; zod validation; secrets server-only.
