import { z } from "zod";
import type { ChoreFrequency, ChoreWeek, Weekday } from "./types";

/** Validates the Add/Edit chore form (FormData fields). */
export const choreInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
    // Checkbox values → unique Mon–Fri weekdays, ascending. Anything else is dropped.
    days: z
      .array(z.string())
      .transform((vals) =>
        [...new Set(vals.map(Number))]
          .filter((n): n is Weekday => Number.isInteger(n) && n >= 1 && n <= 5)
          .sort((a, b) => a - b),
      )
      .refine((d) => d.length > 0, "Pick at least one day"),
    frequency: z.enum(["weekly", "biweekly"]).catch("weekly" as ChoreFrequency),
    week: z.enum(["A", "B"]).catch("A" as ChoreWeek),
    notes: z.string().max(1000, "Notes are too long").optional().transform((v) => v ?? ""),
  })
  // The A/B week only means something for two-week chores.
  .transform((d) => ({ ...d, week: d.frequency === "weekly" ? ("A" as ChoreWeek) : d.week }));

export type ChoreInput = z.infer<typeof choreInputSchema>;

/** Parse FormData → validated input, or a first error message. */
export function parseChoreForm(formData: FormData):
  | { ok: true; data: ChoreInput }
  | { ok: false; error: string } {
  const parsed = choreInputSchema.safeParse({
    name: formData.get("name") ?? "",
    days: formData.getAll("days").map(String),
    frequency: formData.get("frequency") ?? "weekly",
    week: formData.get("week") ?? "A",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return { ok: true, data: parsed.data };
}
