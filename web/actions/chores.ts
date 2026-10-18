"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth";
import { dateSchema } from "@/lib/validation";
import { parseChoreForm } from "@/lib/chores/validation";
import { istToday } from "@/lib/core/logic";
import { applyMove } from "@/lib/chores/logic";
import type { ChoreMove } from "@/lib/chores/types";
import { z } from "zod";
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
  revalidateTag(REPO_TAGS.choreMoves, { expire: 0 });
  revalidateTag(REPO_TAGS.choreCapacity, { expire: 0 });
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

/* ---- One-off reschedules + capacity ---- */

const movesSchema = z.array(z.object({ fromDate: dateSchema, toDate: dateSchema })).max(200);

export type MoveResult = { ok: true; previous: ChoreMove[] } | { ok: false; error: string };

/**
 * Move a chore's occurrences on `fromDates` (one day, or every outstanding day of
 * an overdue chore) to `toDate`, just this once. Returns the chore's previous
 * move list so the UI can offer an instant undo via `restoreChoreMoves`.
 */
export async function moveChore(choreId: string, fromDates: string[], toDate: string): Promise<MoveResult> {
  await guard();
  const to = dateSchema.safeParse(toDate);
  const from = z.array(dateSchema).min(1).max(100).safeParse(fromDates);
  if (!to.success || !from.success) return { ok: false, error: "Invalid date" };
  if (to.data < istToday()) return { ok: false, error: "Pick today or a future date" };
  const repo = getRepository();
  const previous = (await repo.getChoreMoves())
    .filter((m) => m.choreId === choreId)
    .map((m) => ({ fromDate: m.fromDate, toDate: m.toDate }));
  await repo.setChoreMoves(choreId, applyMove(previous, from.data, to.data));
  revalidateChores();
  return { ok: true, previous };
}

/** Undo a move: put back the chore's move list exactly as it was before. */
export async function restoreChoreMoves(choreId: string, moves: ChoreMove[]): Promise<ActionResult> {
  await guard();
  const parsed = movesSchema.safeParse(moves);
  if (!parsed.success) return { ok: false, error: "Invalid moves" };
  await getRepository().setChoreMoves(choreId, parsed.data);
  revalidateChores();
  return { ok: true };
}

/** Daily chore capacity in points (Manage → Chores). */
export async function setChoreCapacity(capacity: number): Promise<ActionResult> {
  await guard();
  const parsed = z.coerce.number().int("Use a whole number").min(1, "Must be at least 1").max(1000, "Must be 1000 or less")
    .safeParse(capacity);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid capacity" };
  await getRepository().setSetting("chore_capacity", String(parsed.data));
  revalidateChores();
  return { ok: true };
}
