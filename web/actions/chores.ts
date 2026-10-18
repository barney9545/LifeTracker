"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth";
import { dateSchema } from "@/lib/validation";
import { parseChoreForm } from "@/lib/chores/validation";
import { istToday } from "@/lib/core/logic";
import { REPO_TAGS } from "@/lib/data";
import type { ActionResult } from "./items";

async function guard() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
}

function revalidateChores() {
  // Same as revalidateAll in items.ts: expire the cached reads so the change
  // shows on the very next render. Chores only appear on Home and Manage.
  revalidateTag(REPO_TAGS.chores, { expire: 0 });
  revalidateTag(REPO_TAGS.choreLogs, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/manage");
}

/** Mark a chore done for IST today. One completion clears every outstanding
 *  occurrence (see choresForDay). Returns the log id so the UI can offer undo. */
export async function markChoreDone(choreId: string, choreName: string): Promise<string> {
  await guard();
  const entry = await getRepository().logChore({ choreId, choreName, date: istToday() });
  revalidateChores();
  return entry.id;
}

export async function undoChoreDone(logId: string) {
  await guard();
  await getRepository().deleteChoreLog(logId);
  revalidateChores();
}

export async function addChore(formData: FormData): Promise<ActionResult> {
  await guard();
  const parsed = parseChoreForm(formData);
  if (!parsed.ok) return parsed;
  await getRepository().addChore({ ...parsed.data, active: true });
  revalidateChores();
  return { ok: true };
}

export async function editChore(id: string, formData: FormData): Promise<ActionResult> {
  await guard();
  const parsed = parseChoreForm(formData);
  if (!parsed.ok) return parsed;
  await getRepository().updateChore(id, parsed.data);
  revalidateChores();
  return { ok: true };
}

export async function toggleChoreActive(id: string, active: boolean) {
  await guard();
  await getRepository().setChoreActive(id, active);
  revalidateChores();
}

/** Pause a chore and auto-resume it on `dateISO` (must be a future day). */
export async function scheduleChoreResume(id: string, dateISO: string): Promise<ActionResult> {
  await guard();
  const d = dateSchema.safeParse(dateISO);
  if (!d.success) return { ok: false, error: "Invalid date" };
  if (d.data <= istToday()) return { ok: false, error: "Pick a future date" };
  await getRepository().scheduleChoreResume(id, d.data);
  revalidateChores();
  return { ok: true };
}

export async function removeChore(id: string) {
  await guard();
  await getRepository().deleteChore(id);
  revalidateChores();
}
