import { z } from "zod";
import type { ChoreFrequency, ChoreWeek, MonthWeek, Weekday } from "./types";

const toWeekday = (v: unknown) => Number(v);
const isWeekday = (n: number): n is Weekday => Number.isInteger(n) && n >= 1 && n <= 7;

/** Validates the Add/Edit chore form (FormData fields). */
export const choreInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80, "Name is too long"),
    // Checkbox values → unique Mon–Sun weekdays, ascending. Anything else is dropped.
    days: z
      .array(z.string())
      .transform((vals) => [...new Set(vals.map(toWeekday))].filter(isWeekday).sort((a, b) => a - b)),
    frequency: z.enum(["weekly", "biweekly", "monthly"]).catch("weekly" as ChoreFrequency),
    week: z.enum(["A", "B"]).catch("A" as ChoreWeek),
    // Monthly: which occurrence (1–4, -1 = last) of which single weekday.
    monthWeek: z.coerce.number().pipe(z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]))
      .catch(1 as MonthWeek),
    monthDay: z.coerce.number().catch(1),
    points: z.coerce.number({ message: "Points must be a number" }).int("Points must be a whole number")
      .min(0, "Points can't be negative").max(200, "Points must be 200 or less"),
    notes: z.string().max(1000, "Notes are too long").optional().transform((v) => v ?? ""),
  })
  // Monthly chores take their one day from the month picker; the A/B week only
  // means something for two-week chores, the month week only for monthly ones.
  .transform(({ monthDay, ...d }) => {
    const monthly = d.frequency === "monthly";
    return {
      ...d,
      days: monthly ? (isWeekday(monthDay) ? [monthDay] : []) : d.days,
      week: d.frequency === "biweekly" ? d.week : ("A" as ChoreWeek),
      monthWeek: monthly ? d.monthWeek : (1 as MonthWeek),
    };
  })
  .refine((d) => d.days.length > 0, "Pick at least one day");

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
    monthWeek: formData.get("month_week") ?? "1",
    monthDay: formData.get("month_day") ?? "1",
    points: formData.get("points") ?? "10",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  return { ok: true, data: parsed.data };
}
