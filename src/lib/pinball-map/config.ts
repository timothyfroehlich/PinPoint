import "server-only";

import { db } from "~/server/db";
import { type Result, ok, err } from "~/lib/result";
import type { PbmConfig } from "./types";

/**
 * Resolve Pinball Map configuration.
 *
 * Resolution order:
 * 1. Database (pinball_map_config table) — primary, set via admin UI
 * 2. Environment variables — fallback for local dev/testing
 *
 * The DB query uses the Drizzle `db` instance (postgres connection string),
 * which bypasses RLS. RLS on pinball_map_config is defense-in-depth for
 * PostgREST access; the primary access control is the admin role check
 * in the server actions that call this function.
 */
export async function getPinballMapConfig(): Promise<
  Result<PbmConfig, "NOT_CONFIGURED">
> {
  // 1. Try database first
  const dbConfig = await db.query.pinballMapConfig.findFirst();

  if (dbConfig) {
    return ok({
      locationId: dbConfig.locationId,
      userEmail: dbConfig.userEmail,
      userToken: dbConfig.userToken,
    });
  }

  // 2. Fall back to environment variables
  const locationId = process.env["PINBALL_MAP_LOCATION_ID"];
  const userEmail = process.env["PINBALL_MAP_USER_EMAIL"];
  const userToken = process.env["PINBALL_MAP_USER_TOKEN"];

  if (locationId && userEmail && userToken) {
    const parsed = Number(locationId);
    if (Number.isNaN(parsed)) {
      return err("NOT_CONFIGURED", "PINBALL_MAP_LOCATION_ID must be a number");
    }
    return ok({
      locationId: parsed,
      userEmail,
      userToken,
    });
  }

  return err(
    "NOT_CONFIGURED",
    "Pinball Map is not configured. Set credentials in Admin > Pinball Map, or set PINBALL_MAP_LOCATION_ID, PINBALL_MAP_USER_EMAIL, and PINBALL_MAP_USER_TOKEN environment variables."
  );
}
