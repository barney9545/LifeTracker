import type { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { dueForSlot, reminderMessage, SLOTS, type Slot } from "@/lib/reminders";
import { runDailyDigest } from "@/lib/summary";
import { sendTelegram } from "@/lib/notify";
import { istHour } from "@/lib/core/logic";
import { REPO_TAGS } from "@/lib/data";

export const dynamic = "force-dynamic";

/** What a single daily cron (08 / 13 / 20 IST) does, chosen by IST time:
 *   morning  → send the daily summary/digest (no reminder)
 *   lunch    → remind Morning + Afternoon supplements still pending
 *   evening  → remind everything still pending */
type Action = "summary" | Slot;

function autoAction(): Action {
  const h = istHour();
  if (h < 11) return "summary"; // ~08:00
  if (h < 16) return "lunch"; //   ~13:00
  return "evening"; //             ~20:00
}

const ACTIONS: string[] = ["summary", ...SLOTS];

/**
 * Scheduled endpoint. Authorize via `Authorization: Bearer ${CRON_SECRET}`.
 * One cron at 08:00/13:00/20:00 IST is enough — the action is derived from the
 * IST hour. Pass `?do=summary|lunch|evening` to force one (handy for testing).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const param = req.nextUrl.searchParams.get("do");
  const action: Action = (ACTIONS.includes(param ?? "") ? param : autoAction()) as Action;

  try {
    if (action === "summary") {
      const { short, items } = await runDailyDigest();
      revalidateTag(REPO_TAGS.ai, { expire: 0 }); // refresh the Today page insight
      return Response.json({ action, sent: items > 0, items, short });
    }

    const items = await dueForSlot(action);
    if (items.length === 0) {
      return Response.json({ action, sent: false, due: 0 });
    }
    await sendTelegram(reminderMessage(action, items));
    return Response.json({ action, sent: true, due: items.length, items: items.map((i) => i.name) });
  } catch (e) {
    return Response.json({ action, error: (e as Error).message }, { status: 500 });
  }
}
