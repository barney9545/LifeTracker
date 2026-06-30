/**
 * MemoryRepository — in-memory implementation of TrackerRepository.
 * Used as a dev/CI fallback when no Google credentials are present, and as
 * proof that the UI/logic are not coupled to Sheets (verification step).
 */
import type { AiSummary, LogEntry, TrackableItem } from "../core/types";
import { daysAgoISO, istToday } from "../core/logic";
import type { ItemPatch, NewItem, NewLog, TrackerRepository } from "./types";

function seedItems(): TrackableItem[] {
  return [
    { id: "1", name: "Vitamin D3", active: true, frequency: "Daily", timeOfDay: "Morning", notes: "", addedDate: daysAgoISO(20), meta: { category: "Vitamin", dosage: "60000", unit: "IU", best_taken_with: "With food", times_per_day: "1" } },
    { id: "2", name: "Omega-3", active: true, frequency: "Daily", timeOfDay: "Morning", notes: "", addedDate: daysAgoISO(20), meta: { category: "Supplement", dosage: "1000", unit: "mg", best_taken_with: "With food", times_per_day: "1" } },
    { id: "3", name: "Magnesium", active: true, frequency: "Daily", timeOfDay: "Evening", notes: "", addedDate: daysAgoISO(20), meta: { category: "Mineral", dosage: "400", unit: "mg", best_taken_with: "With food", times_per_day: "1" } },
    { id: "4", name: "Zinc", active: true, frequency: "Daily", timeOfDay: "Evening", notes: "", addedDate: daysAgoISO(10), meta: { category: "Mineral", dosage: "25", unit: "mg", best_taken_with: "Anytime", times_per_day: "1" } },
    { id: "5", name: "Creatine", active: false, frequency: "Daily", timeOfDay: "Anytime", notes: "", addedDate: daysAgoISO(40), meta: { category: "Performance", dosage: "5", unit: "g", best_taken_with: "Anytime", times_per_day: "1" } },
  ];
}

function seedLogs(): LogEntry[] {
  const logs: LogEntry[] = [];
  let id = 1;
  for (let d = 0; d < 20; d++) {
    const date = daysAgoISO(d);
    // Vitamin D3 — taken through today (strong)
    logs.push({ id: String(id++), itemId: "1", itemName: "Vitamin D3", date, done: true, time: "08:30", notes: "" });
    // Omega-3 — stopped 4 days ago (a gap, like the user's case)
    if (d >= 4) logs.push({ id: String(id++), itemId: "2", itemName: "Omega-3", date, done: true, time: "08:30", notes: "" });
    // Magnesium — every other day
    if (d % 2 === 0) logs.push({ id: String(id++), itemId: "3", itemName: "Magnesium", date, done: true, time: "21:00", notes: "" });
    // Zinc (id 4) — never taken
  }
  return logs;
}

export class MemoryRepository implements TrackerRepository {
  private items = seedItems();
  private logs = seedLogs();
  private summary: AiSummary = {
    short: "You're at a strong streak on Vitamin D3 — nice consistency. Magnesium pairs well with dinner tonight.",
    long: "Over the last 30 days your morning stack is rock solid (Vitamin D3 and Omega-3 near 100%). Magnesium is more hit-or-miss in the evenings — anchoring it to dinner could lift it above 80%. Keep the momentum going.",
    updatedAt: "25 Jun, 08:00",
  };

  async getItems() { return structuredClone(this.items); }
  async getLogs(days: number) {
    const cutoff = daysAgoISO(days);
    return this.logs.filter((l) => l.date >= cutoff).map((l) => ({ ...l }));
  }
  async getAiSummary() { return { ...this.summary }; }

  async addItem(item: NewItem) {
    const id = String(Math.max(0, ...this.items.map((i) => Number(i.id) || 0)) + 1);
    const created: TrackableItem = { ...item, id, addedDate: istToday() };
    this.items.push(created);
    return created;
  }
  async updateItem(id: string, patch: ItemPatch) {
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    Object.assign(it, { ...patch, meta: { ...it.meta, ...(patch.meta ?? {}) } });
  }
  async setActive(id: string, active: boolean) {
    const it = this.items.find((i) => i.id === id);
    if (!it) return;
    it.active = active;
    if (active && !it.addedDate) it.addedDate = istToday();
  }
  async deleteItem(id: string) {
    this.items = this.items.filter((i) => i.id !== id);
  }
  async log(entry: NewLog) {
    const id = String(Math.max(0, ...this.logs.map((l) => Number(l.id) || 0)) + 1);
    const created: LogEntry = {
      id, itemId: entry.itemId, itemName: entry.itemName, date: istToday(),
      done: entry.done, time: entry.time ?? "", notes: entry.notes ?? "",
    };
    this.logs.push(created);
    return created;
  }
  async deleteLog(logId: string) {
    this.logs = this.logs.filter((l) => l.id !== logId);
  }
  async updateLog(logId: string, patch: { time?: string }) {
    const l = this.logs.find((x) => x.id === logId);
    if (l && patch.time !== undefined) l.time = patch.time;
  }
}
