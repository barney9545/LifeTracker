import "server-only";
import { getRepository } from "./repository";
import { alreadyDoneToday, isDue } from "./core/logic";
import type { TrackableItem } from "./core/types";

export type Slot = "morning" | "afternoon" | "evening" | "pending";
export const SLOTS: Slot[] = ["morning", "afternoon", "evening", "pending"];

// Which time_of_day values belong to each slot. "pending" matches any.
const SLOT_TOD: Record<Exclude<Slot, "pending">, string[]> = {
  morning: ["Morning", "Anytime"],
  afternoon: ["Afternoon"],
  evening: ["Evening"],
};

/** Active items that are due and not yet taken today, matching the slot. */
export async function dueForSlot(slot: Slot): Promise<TrackableItem[]> {
  const repo = getRepository();
  const [items, logs] = await Promise.all([repo.getItems(), repo.getLogs(30)]);
  return items.filter((it) => {
    if (!it.active) return false;
    if (alreadyDoneToday(it.id, logs)) return false;
    if (!isDue(it, logs)) return false;
    if (slot === "pending") return true;
    return SLOT_TOD[slot].includes(it.timeOfDay);
  });
}

export function reminderMessage(slot: Slot, items: TrackableItem[]): string {
  const list = items.map((i) => `• ${i.name}`).join("\n");
  return slot === "pending"
    ? `🔔 <b>Still pending today</b>\n${list}`
    : `⏰ <b>Time for your supplements</b>\n${list}`;
}
