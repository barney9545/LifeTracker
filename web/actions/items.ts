"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth";
import { parseItemForm, timeSchema, dateSchema, type ItemInput } from "@/lib/validation";
import { istNowHHMM, istToday } from "@/lib/core/logic";
import { REPO_TAGS } from "@/lib/data";
import { previewDigest } from "@/lib/summary";
import { z } from "zod";

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
  revalidatePath("/calendar");
  // Day pages are dynamic + tag-backed, but revalidate the segment for good measure.
  revalidatePath("/day/[date]", "page");
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

/**
 * Retrospective logging: mark an item done for a specific (past or current) day.
 * Rejects malformed and future dates. Returns the new log id so a MissedCard can
 * hand off to a DoneCard (mirrors markDone).
 */
export async function logForDay(
  itemId: string,
  itemName: string,
  dateISO: string,
  time?: string,
): Promise<string> {
  await guard();
  const d = dateSchema.safeParse(dateISO);
  if (!d.success) throw new Error("Invalid date");
  if (d.data > istToday()) throw new Error("Cannot log a future day");
  const t = timeSchema.safeParse(time);
  const entry = await getRepository().log({
    itemId, itemName, done: true, date: d.data, time: t.success ? t.data : "",
  });
  revalidateAll();
  return entry.id;
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

/** Pause an item and schedule it to auto-resume on `dateISO` (must be a future day). */
export async function scheduleResume(id: string, dateISO: string): Promise<ActionResult> {
  await guard();
  const d = dateSchema.safeParse(dateISO);
  if (!d.success) return { ok: false, error: "Invalid date" };
  if (d.data <= istToday()) return { ok: false, error: "Pick a future date" };
  await getRepository().scheduleResume(id, d.data);
  revalidateAll();
  return { ok: true };
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

/* ---- Daily-summary prompt configuration (stored in the Sheet, no redeploy) ---- */

const summaryConfigSchema = z.object({
  prompt: z.string().trim().min(1, "Prompt is required"),
  temperature: z.coerce.number().min(0, "Temperature must be 0–2").max(2, "Temperature must be 0–2"),
});

export async function saveSummaryConfig(prompt: string, temperature: number): Promise<ActionResult> {
  await guard();
  const parsed = summaryConfigSchema.safeParse({ prompt, temperature });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const repo = getRepository();
  await repo.setSetting("summary_prompt", parsed.data.prompt);
  await repo.setSetting("summary_temperature", String(parsed.data.temperature));
  revalidateAll();
  return { ok: true };
}

export type PreviewResult =
  | { ok: true; short: string; long: string; message: string; debug: string }
  | { ok: false; error: string };

export async function previewSummary(prompt: string, temperature: number): Promise<PreviewResult> {
  await guard();
  const parsed = summaryConfigSchema.safeParse({ prompt, temperature });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const out = await previewDigest(parsed.data.prompt, parsed.data.temperature);
  return { ok: true, ...out };
}
