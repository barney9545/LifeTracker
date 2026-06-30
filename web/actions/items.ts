"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth";
import { parseItemForm, timeSchema, type ItemInput } from "@/lib/validation";
import { istNowHHMM } from "@/lib/core/logic";
import { REPO_TAGS } from "@/lib/data";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function guard() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
}

function revalidateAll() {
  // Expire the cached read layer immediately so the user's own change is fresh
  // on the very next render (passive navigation still uses the 30s cache).
  revalidateTag(REPO_TAGS.items, { expire: 0 });
  revalidateTag(REPO_TAGS.logs, { expire: 0 });
  revalidateTag(REPO_TAGS.ai, { expire: 0 });
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/trends");
}

export async function markDone(itemId: string, itemName: string, time?: string): Promise<string> {
  await guard();
  // The client passes its current IST time; istNowHHMM() is a server-side fallback.
  const t = timeSchema.safeParse(time);
  const entry = await getRepository().log({
    itemId, itemName, done: true, time: t.success ? t.data : istNowHHMM(),
  });
  revalidateAll();
  return entry.id; // returned so the UI can offer an instant undo
}

export async function undoDone(logId: string) {
  await guard();
  await getRepository().deleteLog(logId);
  revalidateAll();
}

export async function updateLogTime(logId: string, time: string): Promise<ActionResult> {
  await guard();
  const t = timeSchema.safeParse(time);
  if (!t.success) return { ok: false, error: t.error.issues[0]?.message ?? "Invalid time" };
  await getRepository().updateLog(logId, { time: t.data });
  revalidateAll();
  return { ok: true };
}

export async function toggleActive(id: string, active: boolean) {
  await guard();
  await getRepository().setActive(id, active);
  revalidateAll();
}

export async function removeItem(id: string) {
  await guard();
  await getRepository().deleteItem(id);
  revalidateAll();
}

function toMeta(d: ItemInput) {
  return {
    category: d.category,
    dosage: String(d.dosage),
    unit: d.unit,
    best_taken_with: d.best_taken_with,
    times_per_day: String(d.times_per_day),
  };
}

export async function addItem(formData: FormData): Promise<ActionResult> {
  await guard();
  const parsed = parseItemForm(formData);
  if (!parsed.ok) return parsed;
  const d = parsed.data;
  await getRepository().addItem({
    name: d.name,
    active: true,
    frequency: d.frequency,
    timeOfDay: d.time_of_day,
    notes: d.notes,
    meta: toMeta(d),
  });
  revalidateAll();
  return { ok: true };
}

export async function editItem(id: string, formData: FormData): Promise<ActionResult> {
  await guard();
  const parsed = parseItemForm(formData);
  if (!parsed.ok) return parsed;
  const d = parsed.data;
  await getRepository().updateItem(id, {
    name: d.name,
    frequency: d.frequency,
    timeOfDay: d.time_of_day,
    notes: d.notes,
    meta: toMeta(d),
  });
  revalidateAll();
  return { ok: true };
}
