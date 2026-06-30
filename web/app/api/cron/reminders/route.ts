import type { NextRequest } from "next/server";
import { dueForSlot, reminderMessage, SLOTS, type Slot } from "@/lib/reminders";
import { sendTelegram } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Scheduled reminder endpoint. Vercel Cron calls it with
 * `Authorization: Bearer ${CRON_SECRET}` (set CRON_SECRET in the env).
 * Computes what's due-and-not-taken for the slot and sends one Telegram message.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const param = req.nextUrl.searchParams.get("slot");
  const slot: Slot = (SLOTS as string[]).includes(param ?? "") ? (param as Slot) : "pending";

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
