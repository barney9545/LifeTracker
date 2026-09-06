import "server-only";
import { getRepository } from "./repository";
import { istToday } from "./core/logic";

/**
 * Activate every paused supplement whose scheduled `resumeOn` date has arrived
 * (<= today, IST). `resumeOn` is kept as the schedule's start day, so `isDue`
 * makes the item due ON its resume date and it then recurs by frequency.
 * Returns the names activated. Idempotent — skips already-active items.
 */
export async function applyScheduledResumes(): Promise<string[]> {
  const repo = getRepository();
  const items = await repo.getItems();
  const today = istToday();
  const activated: string[] = [];

  for (const it of items) {
    const on = /^\d{4}-\d{2}-\d{2}/.test(it.resumeOn ?? "") ? it.resumeOn!.slice(0, 10) : null;
    if (!on || it.active || on > today) continue;
    await repo.resumeScheduled(it.id);
    activated.push(it.name);
  }
  return activated;
}
