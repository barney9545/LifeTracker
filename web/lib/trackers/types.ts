/**
 * A TrackerDefinition describes ONE kind of tracker (supplements today; habits,
 * etc. later). Screens are generic and render from this config, so adding a new
 * tracker is mostly a new definition — not new plumbing.
 */
import type { TrackableItem } from "../core/types";

export interface MetaField {
  key: string; // key inside TrackableItem.meta
  label: string;
  type: "text" | "number" | "select";
  options?: string[];
  required?: boolean;
  default?: string;
}

export interface TrackerDefinition {
  key: string; // "supplements"
  label: string; // singular, "Supplement"
  labelPlural: string; // "Supplements"
  icon: string; // emoji used in headings
  doneVerb: string; // "Mark taken"
  /** Extra (meta) fields shown in the Add/Edit form, beyond name/frequency/timeOfDay/notes. */
  metaFields: MetaField[];
  /** The small grey detail line under an item's name. */
  detail: (item: TrackableItem) => string;
}
