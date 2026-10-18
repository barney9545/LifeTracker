import type { NextRequest } from "next/server";
import { getRepository } from "@/lib/repository";
import { sendTelegram } from "@/lib/notify";
import { istToday } from "@/lib/core/logic";
import { CHORE_LOG_DAYS } from "@/lib/chores/logic";
import { buildNightlyReminder, formatChoreReminderTelegram, isReminderEmpty } from "@/lib/chores/reminder";

export const dynamic = "force-dynamic";

/** A real calendar date in yyyy-mm-dd (round-trips, so 2026-02-30 is rejected). */
function isISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + "T00:00:00Z");
  return !isNaN(t) && new Date(t).toISOString().slice(0, 10) === s;
}

/**
 * Nightly chores reminder (cron 21:00 IST). Authorize via `Authorization: Bearer ${CRON_SECRET}`.
 * Telegrams tomorrow's chores + anything still outstanding; sends nothing if both are empty.
 * Testing: `?date=yyyy-mm-dd` pretends it's that evening, `?dry=1` returns the message unsent.
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
    // Straight from the repository (not the cached read layer) so it's never stale.
    const repo = getRepository();
    const [chores, logs] = await Promise.all([repo.getChores(), repo.getChoreLogs(CHORE_LOG_DAYS)]);
    const r = buildNightlyReminder(chores, logs, today);
    const summary = {
      today,
      date: r.date,
      tomorrow: r.tomorrow.map((t) => t.chore.name),
      overdue: r.overdue.map((o) => o.chore.name),
    };

    if (isReminderEmpty(r)) return Response.json({ ...summary, sent: false, dry });
    const message = formatChoreReminderTelegram(r);
    if (dry) return Response.json({ ...summary, sent: false, dry, message });

    await sendTelegram(message);
    return Response.json({ ...summary, sent: true });
  } catch (e) {
    return Response.json({ today, error: (e as Error).message }, { status: 500 });
  }
}
