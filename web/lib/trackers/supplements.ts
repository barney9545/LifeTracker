import type { TimeOfDay } from "../core/types";
import type { TrackerDefinition } from "./types";

export const CATEGORIES = [
  "Vitamin", "Mineral", "Supplement", "Adaptogen",
  "Performance", "Gut Health", "Herb", "Other",
];
export const UNITS = ["mg", "mcg", "IU", "g", "ml", "B CFU", "other"];
export const TIME_OF_DAY: TimeOfDay[] = ["Morning", "Afternoon", "Evening", "Anytime"];

export const supplementsTracker: TrackerDefinition = {
  key: "supplements",
  label: "Supplement",
  labelPlural: "Supplements",
  icon: "💊",
  doneVerb: "Mark taken",
  metaFields: [
    { key: "category", label: "Category", type: "select", options: CATEGORIES, default: "Supplement" },
    { key: "dosage", label: "Dosage", type: "number", required: true },
    { key: "unit", label: "Unit", type: "select", options: UNITS, default: "mg" },
    { key: "best_taken_with", label: "Best taken with", type: "text" },
  ],
  detail: (item) => {
    const dose = `${item.meta.dosage ?? ""} ${item.meta.unit ?? ""}`.trim();
    const parts = [dose, item.timeOfDay, item.meta.best_taken_with]
      .map((p) => (p ?? "").trim())
      .filter(Boolean);
    return parts.join(" · ");
  },
};
