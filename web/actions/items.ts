"use server";

import { revalidatePath } from "next/cache";
import { getRepository } from "@/lib/repository";
import { getSession } from "@/lib/auth";
import type { Frequency, TimeOfDay } from "@/lib/core/types";

async function guard() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/manage");
  revalidatePath("/trends");
}

export async function markDone(itemId: string, itemName: string, time?: string) {
  await guard();
  await getRepository().log({ itemId, itemName, done: true, time: time || nowHHMM() });
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

function readMeta(formData: FormData) {
  return {
    category: String(formData.get("category") ?? ""),
    dosage: String(formData.get("dosage") ?? ""),
    unit: String(formData.get("unit") ?? ""),
    best_taken_with: String(formData.get("best_taken_with") ?? ""),
    times_per_day: String(formData.get("times_per_day") ?? "1"),
  };
}

export async function addItem(formData: FormData) {
  await guard();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Name is required");
  await getRepository().addItem({
    name,
    active: true,
    frequency: (String(formData.get("frequency") ?? "Daily") || "Daily") as Frequency,
    timeOfDay: (String(formData.get("time_of_day") ?? "Anytime") || "Anytime") as TimeOfDay,
    notes: String(formData.get("notes") ?? ""),
    meta: readMeta(formData),
  });
  revalidateAll();
}

export async function editItem(id: string, formData: FormData) {
  await guard();
  await getRepository().updateItem(id, {
    name: String(formData.get("name") ?? "").trim(),
    frequency: (String(formData.get("frequency") ?? "Daily") || "Daily") as Frequency,
    timeOfDay: (String(formData.get("time_of_day") ?? "Anytime") || "Anytime") as TimeOfDay,
    notes: String(formData.get("notes") ?? ""),
    meta: readMeta(formData),
  });
  revalidateAll();
}
