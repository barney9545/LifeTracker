import type { NextRequest } from "next/server";
import { istToday } from "@/lib/core/logic";
import { runChoresReminder } from "@/lib/chores/nightly";

export const dynamic = "force-dynamic";

/** A real calendar date in yyyy-mm-dd (round-trips, so 2026-02-30 is rejected). */
function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + "T00:00:00Z");
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/**
 * Chores reminder on demand. It normally runs from the 20:00 IST reminders cron;
 * this endpoint is for testing / manual sends. Authorize via `Authorization: Bearer ${CRON_SECRET}`.
 * `?date=yyyy-mm-dd` pretends it's that evening, `?dry=1` returns the message unsent.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const dateParam = params.get("date");
  if (dateParam !== null && !isISODate(dateParam)) {
    return Response.json({ error: "date must be yyyy-mm-dd" }, { status: 400 });
  }
  const today = dateParam ?? istToday();
  const dry = params.get("dry") === "1";

  try {
    return Response.json({ ...(await runChoresReminder(today, dry)), dry });
  } catch (e) {
    return Response.json({ today, error: (e as Error).message }, { status: 500 });
  }
}
