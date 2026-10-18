/**
 * SheetsRepository — TrackerRepository backed by the existing Google Sheet.
 * Server-only (holds the service-account key). Maps the current tab/column
 * names so digest.gs keeps reading the same data unchanged.
 *
 *   supplements: id,name,category,dosage,unit,frequency,times_per_day,
 *                best_taken_with,notes,active,time_of_day
 *   log:         id,date,supplement_id,supplement_name,taken,time_taken,notes
 *   ai_summary:  short,long,updated_at,date
 *   chores:      id,name,days,frequency,week,active,added_date,resumed_date,resume_on,notes
 *                (days like "Mon,Thu"; frequency weekly|biweekly; week A|B)
 *   chore_log:   id,date,chore_id,chore_name,done,notes
 */
import "server-only";
import { GoogleSpreadsheet, type GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import type { AiSummary, Frequency, LogEntry, TimeOfDay, TrackableItem } from "../core/types";
import { daysAgoISO, istStamp, istToday, todayISO } from "../core/logic";
import type { ItemPatch, NewItem, NewLog, TrackerRepository } from "./types";
import type { Chore, ChorePatch, ChoreWeek, NewChore, NewChoreLog, Weekday } from "../chores/types";
import { SEED_CHORES, SEED_START } from "../chores/seed";

const CHORE_HEADERS = [
  "id", "name", "days", "frequency", "week", "active", "added_date", "resumed_date", "resume_on", "notes",
];
const CHORE_LOG_HEADERS = ["id", "date", "chore_id", "chore_name", "done", "notes"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Mon,Thu" (or "1,4") → [1, 4]; weekdays only, ascending, de-duplicated. */
function parseDays(v: unknown): Weekday[] {
  const out = new Set<Weekday>();
  for (const part of String(v ?? "").split(/[,\s]+/)) {
    const p = part.trim().slice(0, 3).toLowerCase();
    if (!p) continue;
    const n = /^\d$/.test(p) ? Number(p) : DAY_NAMES.findIndex((d) => d.toLowerCase() === p) + 1;
    if (n >= 1 && n <= 5) out.add(n as Weekday);
  }
  return [...out].sort((a, b) => a - b);
}

function formatDays(days: Weekday[]): string {
  return days.map((d) => DAY_NAMES[d - 1]).join(",");
}

function rowToChore(r: GoogleSpreadsheetRow): Chore {
  const freq = String(r.get("frequency") ?? "").trim().toLowerCase();
  return {
    id: String(r.get("id") ?? ""),
    name: String(r.get("name") ?? ""),
    days: parseDays(r.get("days")),
    frequency: freq === "biweekly" ? "biweekly" : "weekly",
    week: (String(r.get("week") ?? "").trim().toUpperCase() === "B" ? "B" : "A") as ChoreWeek,
    active: bool(r.get("active")),
    notes: String(r.get("notes") ?? ""),
    addedDate: normDate(r.get("added_date")),
    resumedDate: normDate(r.get("resumed_date")),
    resumeOn: normDate(r.get("resume_on")),
  };
}

function rowToChoreLog(r: GoogleSpreadsheetRow): LogEntry {
  return {
    id: String(r.get("id") ?? ""),
    itemId: String(r.get("chore_id") ?? ""),
    itemName: String(r.get("chore_name") ?? ""),
    date: normDate(r.get("date")),
    done: bool(r.get("done")),
    time: "",
    notes: String(r.get("notes") ?? ""),
  };
}

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getDoc(): GoogleSpreadsheet {
  const sheetId = process.env.SHEET_ID;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!sheetId) throw new Error("SHEET_ID env var is missing");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON env var is missing");

  const creds = JSON.parse(raw) as { client_email: string; private_key: string };
  const jwt = new JWT({
    email: creds.client_email,
    key: creds.private_key.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  });
  return new GoogleSpreadsheet(sheetId, jwt);
}

function bool(v: unknown): boolean {
  return String(v ?? "").trim().toUpperCase() === "TRUE";
}

function normDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : todayISO(d);
}

function rowToItem(r: GoogleSpreadsheetRow): TrackableItem {
  return {
    id: String(r.get("id") ?? ""),
    name: String(r.get("name") ?? ""),
    active: bool(r.get("active")),
    frequency: (String(r.get("frequency") ?? "Daily") || "Daily") as Frequency,
    timeOfDay: (String(r.get("time_of_day") ?? "Anytime") || "Anytime") as TimeOfDay,
    notes: String(r.get("notes") ?? ""),
    addedDate: String(r.get("added_date") ?? ""),
    resumedDate: String(r.get("resumed_date") ?? ""),
    resumeOn: String(r.get("resume_on") ?? ""),
    meta: {
      category: String(r.get("category") ?? ""),
      dosage: String(r.get("dosage") ?? ""),
      unit: String(r.get("unit") ?? ""),
      best_taken_with: String(r.get("best_taken_with") ?? ""),
      times_per_day: String(r.get("times_per_day") ?? "1"),
    },
  };
}

function rowToLog(r: GoogleSpreadsheetRow): LogEntry {
  return {
    id: String(r.get("id") ?? ""),
    itemId: String(r.get("supplement_id") ?? ""),
    itemName: String(r.get("supplement_name") ?? ""),
    date: normDate(r.get("date")),
    done: bool(r.get("taken")),
    time: String(r.get("time_taken") ?? ""),
    notes: String(r.get("notes") ?? ""),
  };
}

function nextId(rows: GoogleSpreadsheetRow[]): string {
  let max = 0;
  for (const r of rows) {
    const n = parseInt(String(r.get("id") ?? ""), 10);
    if (!isNaN(n) && n > max) max = n;
  }
  return String(max + 1);
}

export class SheetsRepository implements TrackerRepository {
  private docPromise: Promise<GoogleSpreadsheet> | null = null;

  private async doc(): Promise<GoogleSpreadsheet> {
    if (!this.docPromise) {
      const d = getDoc();
      this.docPromise = d.loadInfo().then(() => d);
    }
    return this.docPromise;
  }

  private async tab(title: string) {
    const doc = await this.doc();
    const sheet = doc.sheetsByTitle[title];
    if (!sheet) throw new Error(`Worksheet "${title}" not found`);
    return sheet;
  }

  /** Add a header column to a sheet if it's not already present (one-time). */
  private async ensureColumn(
    sheet: Awaited<ReturnType<SheetsRepository["tab"]>>,
    header: string,
  ): Promise<void> {
    try {
      await sheet.loadHeaderRow();
    } catch {
      /* sheet may be empty; nothing to do */
    }
    const headers = sheet.headerValues ?? [];
    if (!headers.includes(header)) {
      await sheet.setHeaderRow([...headers, header]);
    }
  }

  async getItems(): Promise<TrackableItem[]> {
    const rows = await (await this.tab("supplements")).getRows();
    return rows.map(rowToItem);
  }

  async getLogs(days: number): Promise<LogEntry[]> {
    const rows = await (await this.tab("log")).getRows();
    const cutoff = daysAgoISO(days);
    return rows.map(rowToLog).filter((l) => l.date >= cutoff);
  }

  async getAiSummary(): Promise<AiSummary | null> {
    try {
      const rows = await (await this.tab("ai_summary")).getRows();
      if (rows.length === 0) return null;
      const r = rows[rows.length - 1];
      return {
        short: String(r.get("short") ?? ""),
        long: String(r.get("long") ?? ""),
        updatedAt: String(r.get("updated_at") ?? ""),
      };
    } catch {
      return null;
    }
  }

  async saveAiSummary(summary: { short: string; long: string }): Promise<void> {
    const doc = await this.doc();
    let sheet = doc.sheetsByTitle["ai_summary"];
    if (!sheet) {
      sheet = await doc.addSheet({ title: "ai_summary", headerValues: ["short", "long", "updated_at", "date"] });
    }
    await sheet.addRow({
      short: summary.short,
      long: summary.long,
      updated_at: istStamp(),
      date: istToday(),
    });
  }

  async addItem(item: NewItem): Promise<TrackableItem> {
    const sheet = await this.tab("supplements");
    await this.ensureColumn(sheet, "added_date");
    const rows = await sheet.getRows();
    const id = nextId(rows);
    const addedDate = istToday();
    await sheet.addRow({
      id,
      name: item.name,
      category: item.meta.category ?? "",
      dosage: item.meta.dosage ?? "",
      unit: item.meta.unit ?? "",
      frequency: item.frequency,
      times_per_day: item.meta.times_per_day ?? "1",
      best_taken_with: item.meta.best_taken_with ?? "",
      notes: item.notes ?? "",
      active: item.active ? "TRUE" : "FALSE",
      time_of_day: item.timeOfDay,
      added_date: addedDate,
    });
    return { ...item, id, addedDate };
  }

  async updateItem(id: string, patch: ItemPatch): Promise<void> {
    const sheet = await this.tab("supplements");
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(id));
    if (!row) return;
    if (patch.name !== undefined) row.set("name", patch.name);
    if (patch.frequency !== undefined) row.set("frequency", patch.frequency);
    if (patch.timeOfDay !== undefined) row.set("time_of_day", patch.timeOfDay);
    if (patch.notes !== undefined) row.set("notes", patch.notes);
    if (patch.active !== undefined) row.set("active", patch.active ? "TRUE" : "FALSE");
    if (patch.meta) {
      for (const [k, v] of Object.entries(patch.meta)) row.set(k, v);
    }
    await row.save();
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const sheet = await this.tab("supplements");
    await this.ensureColumn(sheet, "resume_on");
    if (active) {
      await this.ensureColumn(sheet, "added_date");
      await this.ensureColumn(sheet, "resumed_date");
    }
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(id));
    if (!row) return;
    row.set("active", active ? "TRUE" : "FALSE");
    // Resuming now, or pausing indefinitely, both drop any pending schedule.
    row.set("resume_on", "");
    if (active) {
      // Stamp the activation date the first time it's made active.
      if (!String(row.get("added_date") ?? "").trim()) {
        row.set("added_date", istToday());
      }
      // Anchor the schedule to the resume day so a resumed item isn't instantly
      // due (issue #8). Leaves added_date — and thus compliance/calendar — intact.
      row.set("resumed_date", istToday());
    }
    await row.save();
  }

  async scheduleResume(id: string, dateISO: string): Promise<void> {
    const sheet = await this.tab("supplements");
    await this.ensureColumn(sheet, "resume_on");
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(id));
    if (!row) return;
    // Keep it paused/hidden; the cron activates it on the scheduled date.
    row.set("active", "FALSE");
    row.set("resume_on", dateISO);
    await row.save();
  }

  async resumeScheduled(id: string): Promise<void> {
    const sheet = await this.tab("supplements");
    await this.ensureColumn(sheet, "added_date");
    await this.ensureColumn(sheet, "resume_on");
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(id));
    if (!row) return;
    // Activate but KEEP resume_on — it is now the schedule's start day (isDue).
    row.set("active", "TRUE");
    if (!String(row.get("added_date") ?? "").trim()) row.set("added_date", istToday());
    await row.save();
  }

  async deleteItem(id: string): Promise<void> {
    const sheet = await this.tab("supplements");
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(id));
    if (row) await row.delete();
  }

  async log(entry: NewLog): Promise<LogEntry> {
    const sheet = await this.tab("log");
    const rows = await sheet.getRows();
    const id = nextId(rows);
    // Honour a caller-supplied date for retrospective logging; else stamp today (IST).
    const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? "") ? entry.date! : istToday();
    await sheet.addRow({
      id,
      date,
      supplement_id: entry.itemId,
      supplement_name: entry.itemName,
      taken: entry.done ? "TRUE" : "FALSE",
      time_taken: entry.time ?? "",
      notes: entry.notes ?? "",
    });
    return {
      id,
      itemId: entry.itemId,
      itemName: entry.itemName,
      date,
      done: entry.done,
      time: entry.time ?? "",
      notes: entry.notes ?? "",
    };
  }

  async deleteLog(logId: string): Promise<void> {
    const sheet = await this.tab("log");
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(logId));
    if (row) await row.delete();
  }

  async updateLog(logId: string, patch: { time?: string }): Promise<void> {
    const sheet = await this.tab("log");
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("id")) === String(logId));
    if (!row) return;
    if (patch.time !== undefined) row.set("time_taken", patch.time);
    await row.save();
  }

  /** Ensure the `settings` (key,value) tab exists, creating it if missing. */
  private async settingsTab() {
    const doc = await this.doc();
    let sheet = doc.sheetsByTitle["settings"];
    if (!sheet) {
      sheet = await doc.addSheet({ title: "settings", headerValues: ["key", "value"] });
    }
    return sheet;
  }

  async getSettings(): Promise<Record<string, string>> {
    try {
      const rows = await (await this.settingsTab()).getRows();
      const out: Record<string, string> = {};
      for (const r of rows) {
        const k = String(r.get("key") ?? "").trim();
        if (k) out[k] = String(r.get("value") ?? "");
      }
      return out;
    } catch {
      return {};
    }
  }

  async setSetting(key: string, value: string): Promise<void> {
    const sheet = await this.settingsTab();
    const rows = await sheet.getRows();
    const row = rows.find((r) => String(r.get("key")) === key);
    if (row) {
      row.set("value", value);
      await row.save();
    } else {
      await sheet.addRow({ key, value });
    }
  }

  /* ---- Chores ---- */

  private choreTabs: Promise<void> | null = null;

  /** Create `chores` (seeded with the starting list) and `chore_log` on first use. */
  private ensureChoreTabs(): Promise<void> {
    if (!this.choreTabs) {
      this.choreTabs = (async () => {
        const doc = await this.doc();
        if (!doc.sheetsByTitle["chores"]) {
          const sheet = await doc.addSheet({ title: "chores", headerValues: CHORE_HEADERS });
          await sheet.addRows(
            SEED_CHORES.map((c, i) => ({
              id: String(i + 1), name: c.name, days: formatDays(c.days), frequency: c.frequency,
              week: c.week, active: c.active ? "TRUE" : "FALSE", added_date: SEED_START,
              resumed_date: "", resume_on: "", notes: c.notes,
            })),
          );
        }
        if (!doc.sheetsByTitle["chore_log"]) {
          await doc.addSheet({ title: "chore_log", headerValues: CHORE_LOG_HEADERS });
        }
      })().catch((e) => {
        this.choreTabs = null; // let the next call retry
        throw e;
      });
    }
    return this.choreTabs;
  }

  private async choreRow(id: string) {
    await this.ensureChoreTabs();
    const rows = await (await this.tab("chores")).getRows();
    return rows.find((r) => String(r.get("id")) === String(id));
  }

  async getChores(): Promise<Chore[]> {
    await this.ensureChoreTabs();
    const rows = await (await this.tab("chores")).getRows();
    return rows.map(rowToChore).filter((c) => c.id && c.name);
  }

  async getChoreLogs(days: number): Promise<LogEntry[]> {
    await this.ensureChoreTabs();
    const rows = await (await this.tab("chore_log")).getRows();
    const cutoff = daysAgoISO(days);
    return rows.map(rowToChoreLog).filter((l) => l.date >= cutoff);
  }

  async addChore(chore: NewChore): Promise<Chore> {
    await this.ensureChoreTabs();
    const sheet = await this.tab("chores");
    const id = nextId(await sheet.getRows());
    const addedDate = istToday();
    await sheet.addRow({
      id, name: chore.name, days: formatDays(chore.days), frequency: chore.frequency,
      week: chore.week, active: chore.active ? "TRUE" : "FALSE", added_date: addedDate,
      resumed_date: "", resume_on: "", notes: chore.notes ?? "",
    });
    return { ...chore, id, addedDate };
  }

  async updateChore(id: string, patch: ChorePatch): Promise<void> {
    const row = await this.choreRow(id);
    if (!row) return;
    if (patch.name !== undefined) row.set("name", patch.name);
    if (patch.days !== undefined) row.set("days", formatDays(patch.days));
    if (patch.frequency !== undefined) row.set("frequency", patch.frequency);
    if (patch.week !== undefined) row.set("week", patch.week);
    if (patch.notes !== undefined) row.set("notes", patch.notes);
    await row.save();
  }

  async setChoreActive(id: string, active: boolean): Promise<void> {
    const row = await this.choreRow(id);
    if (!row) return;
    row.set("active", active ? "TRUE" : "FALSE");
    row.set("resume_on", "");
    if (active) row.set("resumed_date", istToday());
    await row.save();
  }

  async scheduleChoreResume(id: string, dateISO: string): Promise<void> {
    const row = await this.choreRow(id);
    if (!row) return;
    row.set("active", "FALSE");
    row.set("resume_on", dateISO);
    await row.save();
  }

  async deleteChore(id: string): Promise<void> {
    const row = await this.choreRow(id);
    if (row) await row.delete();
  }

  async logChore(entry: NewChoreLog): Promise<LogEntry> {
    await this.ensureChoreTabs();
    const sheet = await this.tab("chore_log");
    const id = nextId(await sheet.getRows());
    const date = /^\d{4}-\d{2}-\d{2}$/.test(entry.date ?? "") ? entry.date! : istToday();
    await sheet.addRow({ id, date, chore_id: entry.choreId, chore_name: entry.choreName, done: "TRUE", notes: "" });
    return { id, itemId: entry.choreId, itemName: entry.choreName, date, done: true, time: "", notes: "" };
  }

  async deleteChoreLog(logId: string): Promise<void> {
    await this.ensureChoreTabs();
    const rows = await (await this.tab("chore_log")).getRows();
    const row = rows.find((r) => String(r.get("id")) === String(logId));
    if (row) await row.delete();
  }
}
