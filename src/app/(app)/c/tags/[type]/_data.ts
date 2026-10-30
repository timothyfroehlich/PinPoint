import "server-only";

import { cache } from "react";

import { db } from "~/server/db";
import { exclusiveConflicts } from "~/lib/tags/conflicts";
import type { TagConflictMachine } from "~/lib/tags/types";

/**
 * The machines that would block making this tag type one-per-machine (spec
 * collections-and-tags 11.7). `cache()`-wrapped per request.
 */
export const getExclusiveConflicts = cache(
  (tagTypeId: string): Promise<TagConflictMachine[]> =>
    exclusiveConflicts(db, tagTypeId)
);
