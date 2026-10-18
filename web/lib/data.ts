import "server-only";
import { unstable_cache } from "next/cache";
import { getRepository } from "./repository";
import { DEFAULT_CAPACITY } from "./chores/logic";

/**
 * Cached read layer over the repository. Cross-navigation reads are served from
 * cache (~fast); mutations call `revalidateTag` (see actions/items.ts) so the
 * user's own changes appear immediately. A *direct* Google Sheet edit can take
 * up to `revalidate` seconds to surface.
 */
export const REPO_TAGS = {
  items: "repo:items", logs: "repo:logs", ai: "repo:ai",
  chores: "repo:chores", choreLogs: "repo:chore-logs", choreMoves: "repo:chore-moves",
  choreCapacity: "repo:chore-capacity",
} as const;

export const getItems = unstable_cache(
  () => getRepository().getItems(),
  ["repo-items"],
  { tags: [REPO_TAGS.items], revalidate: 30 },
);

export const getLogs = unstable_cache(
  (days: number) => getRepository().getLogs(days),
  ["repo-logs"],
  { tags: [REPO_TAGS.logs], revalidate: 30 },
);

export const getAiSummary = unstable_cache(
  () => getRepository().getAiSummary(),
  ["repo-ai"],
  { tags: [REPO_TAGS.ai], revalidate: 60 },
);

export const getChores = unstable_cache(
  () => getRepository().getChores(),
  ["repo-chores"],
  { tags: [REPO_TAGS.chores], revalidate: 30 },
);

export const getChoreLogs = unstable_cache(
  (days: number) => getRepository().getChoreLogs(days),
  ["repo-chore-logs"],
  { tags: [REPO_TAGS.choreLogs], revalidate: 30 },
);

export const getChoreMoves = unstable_cache(
  () => getRepository().getChoreMoves(),
  ["repo-chore-moves"],
  { tags: [REPO_TAGS.choreMoves], revalidate: 30 },
);

/** Daily chore capacity (settings key `chore_capacity`), default 100. */
export const getChoreCapacity = unstable_cache(
  async () => {
    const n = Number((await getRepository().getSettings())["chore_capacity"]);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_CAPACITY;
  },
  ["repo-chore-capacity"],
  { tags: [REPO_TAGS.choreCapacity], revalidate: 60 },
);
