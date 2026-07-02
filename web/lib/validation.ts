import { z } from "zod";
import { FREQUENCIES } from "./core/logic";
import { CATEGORIES, TIME_OF_DAY, UNITS } from "./trackers/supplements";

/** Coerce a select value to one of `allowed`, falling back if somehow invalid. */
function enumOr<T extends string>(allowed: readonly T[], fallback: T) {
  return z.string().transform((v) => (allowed.includes(v as T) ? (v as T) : fallback));
}

/** Validates the Add/Edit supplement form (FormData fields). */
export const itemInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
  frequency: enumOr(FREQUENCIES, "Daily"),
  time_of_day: enumOr(TIME_OF_DAY, "Anytime"),
  notes: z.string().max(1000).optional().transform((v) => v ?? ""),
  category: enumOr(CATEGORIES, "Supplement"),
  dosage: z.coerce.number({ message: "Dosage must be a number" }).positive("Dosage is required"),
  unit: enumOr(UNITS, "mg"),
  best_taken_with: z.string().max(200).optional().transform((v) => v ?? ""),
  times_per_day: z.coerce.number().int().min(1).max(12).catch(1),
});

export type ItemInput = z.infer<typeof itemInputSchema>;

/** A 24-hour HH:MM time string, e.g. "08:00" or "21:45". */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");

/** An ISO calendar date (yyyy-mm-dd). Callers additionally reject future dates. */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");

/** Parse FormData → validated input, or a first error message. */
export function parseItemForm(formData: FormData):
  | { ok: true; data: ItemInput }
  | { ok: false; error: string } {
  const parsed = itemInputSchema.safeParse({
    name: formData.get("name") ?? "",
    frequency: formData.get("frequency") ?? "Daily",
    time_of_day: formData.get("time_of_day") ?? "Anytime",
    notes: formData.get("notes") ?? "",
    category: formData.get("category") ?? "Supplement",
    dosage: formData.get("dosage") ?? "",
    unit: formData.get("unit") ?? "mg",
    best_taken_with: formData.get("best_taken_with") ?? "",
    times_per_day: formData.get("times_per_day") ?? "1",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return { ok: true, data: parsed.data };
}
