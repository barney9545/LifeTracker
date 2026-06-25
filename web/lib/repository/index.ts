/**
 * Repository factory — the ONE place that decides which data store backs the
 * app. To migrate to Postgres/Supabase later: add a PostgresRepository and
 * return it here. Nothing else in the app changes.
 */
import "server-only";
import type { TrackerRepository } from "./types";
import { MemoryRepository } from "./memory";
import { SheetsRepository } from "./sheets";

let instance: TrackerRepository | null = null;

export function getRepository(): TrackerRepository {
  if (instance) return instance;

  const useMemory =
    process.env.REPOSITORY === "memory" || !process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  instance = useMemory ? new MemoryRepository() : new SheetsRepository();
  return instance;
}

export type { TrackerRepository } from "./types";
