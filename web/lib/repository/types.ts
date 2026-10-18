/**
 * The single seam between the app and its data store.
 *
 * UI and business logic depend ONLY on this interface — never on Google Sheets
 * directly. Today it's backed by SheetsRepository; swapping to Postgres/Supabase
 * later means writing one new implementation and changing one line in index.ts,
 * with zero changes to screens, actions, or core logic.
 */
import type { AiSummary, LogEntry, TrackableItem } from "../core/types";
import type { Chore, ChoreMove, ChorePatch, NewChore, NewChoreLog, StoredChoreMove } from "../chores/types";

// `addedDate` is stamped by the repository on insert, so callers don't supply it.
export type NewItem = Omit<TrackableItem, "id" | "addedDate">;
export type ItemPatch = Partial<Omit<TrackableItem, "id" | "addedDate">>;

export interface NewLog {
  itemId: string;
  itemName: string;
  done: boolean;
  time?: string;
  notes?: string;
  /** ISO date (yyyy-mm-dd) to log against; defaults to IST today when omitted/invalid. */
  date?: string;
}

export interface TrackerRepository {
  /** All items (active and paused). */
  getItems(): Promise<TrackableItem[]>;
  /** Log entries within the last `days` days. */
  getLogs(days: number): Promise<LogEntry[]>;
  /** Latest AI summary, or null if none. */
  getAiSummary(): Promise<AiSummary | null>;
  /** Append a new AI summary (daily digest writes this so the Today page updates). */
  saveAiSummary(summary: { short: string; long: string }): Promise<void>;

  /** Generic key/value app settings (e.g. tunable digest prompt), keyed by string. */
  getSettings(): Promise<Record<string, string>>;
  /** Upsert a single setting by key. */
  setSetting(key: string, value: string): Promise<void>;

  addItem(item: NewItem): Promise<TrackableItem>;
  updateItem(id: string, patch: ItemPatch): Promise<void>;
  /** Activate/pause immediately. Resuming stamps `resumed_date = today`; either
   *  direction clears any pending `resume_on` (resume-now / cancel-schedule). */
  setActive(id: string, active: boolean): Promise<void>;
  /** Pause the item and schedule it to auto-resume on `dateISO` (kept hidden until then). */
  scheduleResume(id: string, dateISO: string): Promise<void>;
  /** Cron only: activate a scheduled item, KEEPING `resume_on` as its cycle start
   *  (that day becomes the first due day; pre-pause doses are ignored by isDue). */
  resumeScheduled(id: string): Promise<void>;
  deleteItem(id: string): Promise<void>;

  /** Record that an item was done (or skipped). Returns the created entry. */
  log(entry: NewLog): Promise<LogEntry>;
  /** Remove a single log entry by id (used to undo an accidental mark-done). */
  deleteLog(logId: string): Promise<void>;
  /** Patch a single log entry by id (e.g. correct the time it was taken). */
  updateLog(logId: string, patch: { time?: string }): Promise<void>;

  /* ---- Chores (own tabs: `chores` + `chore_log`; completions reuse LogEntry) ---- */

  /** All chores (active and paused). Seeds the starting list if the store has none yet. */
  getChores(): Promise<Chore[]>;
  /** Chore completions within the last `days` days (LogEntry.itemId = chore id). */
  getChoreLogs(days: number): Promise<LogEntry[]>;
  addChore(chore: NewChore): Promise<Chore>;
  updateChore(id: string, patch: ChorePatch): Promise<void>;
  /** Same semantics as setActive: resuming stamps resumedDate = today; both clear resumeOn. */
  setChoreActive(id: string, active: boolean): Promise<void>;
  /** Pause and auto-resume on `dateISO` (no cron needed — logic treats it as active from then). */
  scheduleChoreResume(id: string, dateISO: string): Promise<void>;
  /** Removes the chore; its history rows are kept. */
  deleteChore(id: string): Promise<void>;
  /** Record a completion (date defaults to IST today). */
  logChore(entry: NewChoreLog): Promise<LogEntry>;
  /** Undo a completion. */
  deleteChoreLog(logId: string): Promise<void>;
  /** All one-off reschedules (`chore_moves` tab). */
  getChoreMoves(): Promise<StoredChoreMove[]>;
  /** Replace one chore's moves wholesale (moving and undo both compute the full list via applyMove). */
  setChoreMoves(choreId: string, moves: ChoreMove[]): Promise<void>;
}
