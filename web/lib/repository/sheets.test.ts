/*
 * SheetsRepository read path, against a stubbed Google API (no network): every
 * getter is served from ONE batched values request, concurrent getters share it,
 * and a missing tab falls back to reading whatever tabs exist.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

process.env.SHEET_ID = "test-sheet";
process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: "x@example.com", private_key: "k" });

const { SheetsRepository } = await import("./sheets");

const GRIDS: Record<string, string[][]> = {
  supplements: [
    ["id", "name", "active", "frequency", "time_of_day", "added_date"],
    ["1", "Vitamin D3", "TRUE", "Daily", "Morning", "2026-10-01"],
    [],
    ["2", "Zinc", "FALSE"],
  ],
  log: [
    ["id", "date", "supplement_id", "supplement_name", "taken", "time_taken"],
    ["1", "2020-01-01", "1", "Vitamin D3", "TRUE", "08:00"],
    ["2", "2099-01-01", "1", "Vitamin D3", "TRUE", "08:00"],
  ],
  ai_summary: [["short", "long", "updated_at"], ["old", "old", "t1"], ["new", "newer", "t2"]],
  settings: [["key", "value"], ["chore_capacity", "120"], ["", "ignored"]],
  chores: [
    [" id ", "name", "days", "frequency", "week", "active", "added_date"],
    ["1", "Laundry", "Mon,Thu", "weekly", "A", "TRUE", "2026-10-19"],
    ["2", "", "Mon"],
  ],
  chore_log: [["id", "date", "chore_id", "chore_name", "done", "notes"], ["1", "2099-01-01", "1", "Laundry", "FALSE", "missed"]],
  chore_moves: [["chore_id", "from_date", "to_date"], ["1", "2026-10-19", "2026-10-20"], ["1", "junk", "2026-10-20"]],
};

type Req = { url: string };
function stub(repo: InstanceType<typeof SheetsRepository>, missing: string[] = []) {
  const calls: string[][] = [];
  const client = (repo as unknown as { client: { jwt: { request: (r: Req) => Promise<unknown> } } }).client;
  client.jwt.request = async ({ url }: Req) => {
    const tabs = new URL(url).searchParams.getAll("ranges").map((r) => r.slice(1, -1));
    calls.push(tabs);
    if (tabs.some((t) => missing.includes(t))) throw Object.assign(new Error("Unable to parse range"), { status: 400 });
    return { data: { valueRanges: tabs.map((t) => ({ values: GRIDS[t] })) } };
  };
  return calls;
}

describe("SheetsRepository snapshot", () => {
  it("parses every tab from one request", async () => {
    const repo = new SheetsRepository();
    const calls = stub(repo);
    const s = await repo.getSnapshot();
    assert.equal(calls.length, 1);
    assert.equal(calls[0].length, 7);
    assert.deepEqual(s.items.map((i) => [i.id, i.name, i.active]), [["1", "Vitamin D3", true], ["2", "Zinc", false]]);
    assert.equal(s.items[0].timeOfDay, "Morning");
    assert.equal(s.logs.length, 2);
    assert.deepEqual(s.aiSummary, { short: "new", long: "newer", updatedAt: "t2" });
    assert.deepEqual(s.settings, { chore_capacity: "120" });
    assert.deepEqual(s.chores.map((c) => [c.id, c.name, c.days]), [["1", "Laundry", [1, 4]]]); // header trimmed, nameless dropped
    assert.deepEqual(s.choreLogs.map((l) => [l.done, l.notes]), [[false, "missed"]]);
    assert.deepEqual(s.choreMoves, [{ choreId: "1", fromDate: "2026-10-19", toDate: "2026-10-20" }]);
  });

  it("concurrent getters share one request; later calls read again", async () => {
    const repo = new SheetsRepository();
    const calls = stub(repo);
    const [items, logs, chores, moves, settings, ai] = await Promise.all([
      repo.getItems(), repo.getLogs(30), repo.getChores(), repo.getChoreMoves(), repo.getSettings(), repo.getAiSummary(),
    ]);
    assert.equal(calls.length, 1);
    assert.equal(items.length, 2);
    assert.deepEqual(logs.map((l) => l.id), ["2"]); // 2020 row is outside 30 days
    assert.equal(chores.length, 1);
    assert.equal(moves.length, 1);
    assert.equal(settings.chore_capacity, "120");
    assert.equal(ai?.short, "new");
    await repo.getItems();
    assert.equal(calls.length, 2); // no stale cross-request memo
  });

  it("falls back to the tabs that exist when one is missing", async () => {
    const repo = new SheetsRepository();
    const calls = stub(repo, ["ai_summary"]);
    // Pretend loadInfo found every tab except ai_summary (and nothing needs creating).
    const sheetsByTitle = Object.fromEntries(Object.keys(GRIDS).filter((t) => t !== "ai_summary")
      .map((t) => [t, { title: t, headerValues: [...(GRIDS[t][0] ?? []), "month_week", "points"] }]));
    const r = repo as unknown as { docPromise: Promise<unknown> };
    r.docPromise = Promise.resolve({ sheetsByTitle });
    const s = await repo.getSnapshot();
    assert.equal(calls.length, 2);
    assert.ok(!calls[1].includes("ai_summary"));
    assert.equal(s.aiSummary, null);
    assert.equal(s.items.length, 2);
    await repo.getSnapshot();
    assert.ok(!calls[2].includes("ai_summary")); // remembered: no failing request first
  });
});
