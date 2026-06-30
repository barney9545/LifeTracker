"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth";
import { parseItemForm, type ItemInput } from "@/lib/validation";
import { REPO_TAGS } from "@/lib/data";

export type ActionResult = { ok: true } | { ok: false; error: string };

async function guard() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
  const entry = await getRepository().log({ itemId, itemName, done: true, time: time || nowHHMM() });
  revalidateAll();
  return entry.id; // returned so the UI can offer an instant undo
}

export async function undoDone(logId: string) {
  await guard();
  await getRepository().deleteLog(logId);
  revalidateAll();
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
