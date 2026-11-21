import "server-only";

import { cache } from "react";

import { db } from "~/server/db";
import {
  getSettingsTagPage,
  listSettingsTagSummaries,
} from "~/lib/machines/settings-tag-queries";
import type {
  SettingsTagPage,
  SettingsTagSummary,
} from "~/lib/machines/settings-tags";

/**
 * Every settings tag with how many sets carry it (machine-settings §3.7).
 * `cache()`-wrapped per request.
 */
export const getSettingsTagSummaries = cache(
  (): Promise<SettingsTagSummary[]> => listSettingsTagSummaries(db)
);

/**
 * One settings tag's page (machine-settings §3.6), or null when no tag has
 * this slug. `cache()`-wrapped so `generateMetadata` and the page share it.
 */
export const getSettingsTag = cache(
  (slug: string): Promise<SettingsTagPage | null> =>
    getSettingsTagPage(db, slug)
);
