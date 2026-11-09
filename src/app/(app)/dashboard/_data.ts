import "server-only";

import { cache } from "react";

import { db } from "~/server/db";
import { loadDashboardData } from "~/lib/dashboard/queries";

/**
 * Cached dashboard data fetcher (CORE-PERF-001)
 * Wraps all dashboard queries to prevent duplicate execution within a single request
 */
export const getDashboardData = cache(async (userId?: string) =>
  loadDashboardData(db, userId)
);
