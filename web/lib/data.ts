import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { getRepository } from "./repository";
import { DEFAULT_CAPACITY } from "./chores/logic";
import { daysAgoISO } from "./core/logic";
import type { LogEntry } from "./core/types";

/**
 * Cached read layer over the repository.
 *
 * Google Sheets limits read requests per minute, so everything the app reads
 * comes from ONE cached snapshot (one batched API read for all tabs), and every
 * getter below derives from it — no matter how many getters a page calls, or
 * how many different `days` windows they ask for.
 *
 * Mutations call `revalidateRepo()` so the user's own changes appear on the very
 * next render (costing one read). A *direct* Google Sheet edit can take up to
 * `revalidate` seconds to surface.
 */
export const REPO_TAG = "repo:snapshot";

const cachedSnapshot = unstable_cache(
  () => getRepository().getSnapshot(),
  ["repo-snapshot-v1"],
  { tags: [REPO_TAG], revalidate: 60 },
);

/** Per-request dedupe on top of the cross-request cache. */
const getSnapshot = cache(() => cachedSnapshot());

/** Expire the cached snapshot (call after any write). */
export function revalidateRepo() {
  revalidateTag(REPO_TAG, { expire: 0 });
}

const since = (logs: LogEntry[], days: number) => {
  const cutoff = daysAgoISO(days);
  return logs.filter((l) => l.date >= cutoff);
};

export const getItems = async () => (await getSnapshot()).items;

export const getLogs = async (days: number) => since((await getSnapshot()).logs, days);

export const getAiSummary = async () => (await getSnapshot()).aiSummary;

export const getSettings = async () => (await getSnapshot()).settings;

export const getChores = async () => (await getSnapshot()).chores;

export const getChoreLogs = async (days: number) => since((await getSnapshot()).choreLogs, days);

export const getChoreMoves = async () => (await getSnapshot()).choreMoves;

/** Daily chore capacity (settings key `chore_capacity`), default 100. */
export async function getChoreCapacity(): Promise<number> {
  const n = Number((await getSettings())["chore_capacity"]);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_CAPACITY;
}
