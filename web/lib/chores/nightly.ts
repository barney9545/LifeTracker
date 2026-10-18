import "server-only";
import { getRepository } from "../repository";
import { sendTelegram } from "../notify";
import { CHORE_LOG_DAYS } from "./logic";
import { buildNightlyReminder, formatChoreReminderTelegram, isReminderEmpty } from "./reminder";

/**
 * Evening chores reminder: tomorrow's chores + anything still outstanding, sent
 * to Telegram. Rides on the existing 20:00 IST reminders cron (and is callable on
 * its own via /api/cron/chores). Sends nothing when both lists are empty.
 * Reads straight from the repository (not the cached read layer) so it's never stale.
 */
export async function runChoresReminder(today: string, dry = false) {
  const repo = getRepository();
  const [chores, logs] = await Promise.all([repo.getChores(), repo.getChoreLogs(CHORE_LOG_DAYS)]);
  const r = buildNightlyReminder(chores, logs, today);
  const summary = {
    today,
    date: r.date,
    tomorrow: r.tomorrow.map((t) => t.chore.name),
    overdue: r.overdue.map((o) => o.chore.name),
  };

  if (isReminderEmpty(r)) return { ...summary, sent: false };
  const message = formatChoreReminderTelegram(r);
  if (dry) return { ...summary, sent: false, message };

  await sendTelegram(message);
  return { ...summary, sent: true };
}
