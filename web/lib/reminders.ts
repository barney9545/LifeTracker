import "server-only";
import { getRepository } from "./repository";
import { alreadyDoneToday, isDue } from "./core/logic";
import type { TrackableItem } from "./core/types";

/**
 * Reminder slots:
 *   lunch    (≈1pm) — supplements taken before/with lunch (Morning + Afternoon).
 *   evening  (≈8pm) — everything still pending, any time of day (the catch-all).
 * The morning slot is no longer a reminder — 8am sends the daily summary instead
 * (see lib/summary.ts + the cron route).
 */
export type Slot = "lunch" | "evening";
export const SLOTS: Slot[] = ["lunch", "evening"];

// Which time_of_day values each slot reminds about. `null` = every remaining item.
const SLOT_TOD: Record<Slot, string[] | null> = {
  lunch: ["Morning", "Afternoon"],
  evening: null,
};

/** Active items that are due and not yet taken today, matching the slot. */
export async function dueForSlot(slot: Slot): Promise<TrackableItem[]> {
  const repo = getRepository();
  const [items, logs] = await Promise.all([repo.getItems(), repo.getLogs(30)]);
  const tod = SLOT_TOD[slot];
  return items.filter((it) => {
    if (!it.active) return false;
    if (alreadyDoneToday(it.id, logs)) return false;
    if (!isDue(it, logs)) return false;
    return tod === null || tod.includes(it.timeOfDay);
  });
}

export function reminderMessage(slot: Slot, items: TrackableItem[]): string {
  const list = items.map((i) => `• ${i.name}`).join("\n");
  return slot === "evening"
    ? `🔔 <b>Still pending today</b>\n${list}`
    : `⏰ <b>Time for your supplements</b>\n${list}`;
}
