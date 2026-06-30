import "server-only";
import { unstable_cache } from "next/cache";
import { getRepository } from "./repository";

/**
 * Cached read layer over the repository. Cross-navigation reads are served from
 * cache (~fast); mutations call `revalidateTag` (see actions/items.ts) so the
 * user's own changes appear immediately. A *direct* Google Sheet edit can take
 * up to `revalidate` seconds to surface.
 */
export const REPO_TAGS = { items: "repo:items", logs: "repo:logs", ai: "repo:ai" } as const;

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
