/**
 * The single seam between the app and its data store.
 *
 * UI and business logic depend ONLY on this interface — never on Google Sheets
 * directly. Today it's backed by SheetsRepository; swapping to Postgres/Supabase
 * later means writing one new implementation and changing one line in index.ts,
 * with zero changes to screens, actions, or core logic.
 */
import type { AiSummary, LogEntry, TrackableItem } from "../core/types";

// `addedDate` is stamped by the repository on insert, so callers don't supply it.
export type NewItem = Omit<TrackableItem, "id" | "addedDate">;
export type ItemPatch = Partial<Omit<TrackableItem, "id" | "addedDate">>;

export interface NewLog {
  itemId: string;
  itemName: string;
  done: boolean;
  time?: string;
  notes?: string;
}

export interface TrackerRepository {
  /** All items (active and paused). */
  getItems(): Promise<TrackableItem[]>;
  /** Log entries within the last `days` days. */
  getLogs(days: number): Promise<LogEntry[]>;
  /** Latest AI summary, or null if none. */
  getAiSummary(): Promise<AiSummary | null>;

  addItem(item: NewItem): Promise<TrackableItem>;
  updateItem(id: string, patch: ItemPatch): Promise<void>;
  setActive(id: string, active: boolean): Promise<void>;
  deleteItem(id: string): Promise<void>;

  /** Record that an item was done (or skipped). Returns the created entry. */
  log(entry: NewLog): Promise<LogEntry>;
}
