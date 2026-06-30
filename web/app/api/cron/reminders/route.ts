import type { NextRequest } from "next/server";
import { dueForSlot, reminderMessage, SLOTS, type Slot } from "@/lib/reminders";
import { sendTelegram } from "@/lib/notify";
import { istHour } from "@/lib/core/logic";

export const dynamic = "force-dynamic";

/** Pick the slot from the current India time, so one daily multi-time cron
 *  (08/13/20/21) needs no per-call `slot` param. */
function autoSlot(): Slot {
  const h = istHour();
  if (h >= 6 && h < 11) return "morning";
  if (h >= 11 && h < 16) return "afternoon";
  if (h >= 16 && h < 21) return "evening";
  return "pending";
}

/**
 * Scheduled reminder endpoint. Authorize via `Authorization: Bearer ${CRON_SECRET}`.
 * Pass `?slot=morning|afternoon|evening|pending` to force a slot, or omit it and
 * the slot is derived from the current IST time (so a single multi-time cron works).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const param = req.nextUrl.searchParams.get("slot");
  const slot: Slot = (SLOTS as string[]).includes(param ?? "") ? (param as Slot) : autoSlot();

  try {
    const items = await dueForSlot(slot);
    if (items.length === 0) {
      return Response.json({ slot, sent: false, due: 0 });
    }
    await sendTelegram(reminderMessage(slot, items));
    return Response.json({ slot, sent: true, due: items.length, items: items.map((i) => i.name) });
  } catch (e) {
    return Response.json({ slot, error: (e as Error).message }, { status: 500 });
  }
}
