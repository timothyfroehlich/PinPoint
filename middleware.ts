import { type NextRequest } from "next/server";
import { env } from "~/env";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { updateSession } from "~/utils/supabase/middleware";

/**
 * Production Safety Check - Test Data Detection
 *
 * Detects if test organizations exist in production database and blocks
 * all requests to prevent accidental data corruption or security breaches.
 *
 * THREAT MODEL:
 * - Accidental seeding of production database with dev/test data
 * - Database restore from wrong environment backup
 *
 * PERFORMANCE: Cached with periodic refresh (every 100 requests or 5 minutes)
 */

const TEST_ORG_IDS = [
  SEED_TEST_IDS.ORGANIZATIONS.primary,
  SEED_TEST_IDS.ORGANIZATIONS.competitor,
] as const;
const TEST_ORG_QUERY_PARAM = `in.(${TEST_ORG_IDS.map((id) => encodeURIComponent(id)).join(",")})`;
const SUPABASE_REST_ORGS_PATH = "/rest/v1/organizations";

interface SafetyCheckCache {
  testOrgsDetected: boolean;
  lastChecked: number;
  requestCount: number;
}

const cache: SafetyCheckCache = {
  testOrgsDetected: false,
  lastChecked: 0,
  requestCount: 0,
};

const RECHECK_INTERVAL_REQUESTS = 100;
const RECHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function checkForTestOrganizations(): Promise<boolean> {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "[CRITICAL] Production safety check missing Supabase credentials - assuming unsafe",
      {
        supabaseUrlPresent: Boolean(supabaseUrl),
        serviceRolePresent: Boolean(serviceRoleKey),
        action: "SAFETY_CHECK_ENV_MISSING",
      },
    );
    return true;
  }

  const restUrl = new URL(SUPABASE_REST_ORGS_PATH, supabaseUrl);
  restUrl.searchParams.set("select", "id");
  restUrl.searchParams.set("limit", "1");
  restUrl.searchParams.set("id", TEST_ORG_QUERY_PARAM);

  try {
    const response = await fetch(restUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        "[CRITICAL] Production safety check REST query failed - assuming unsafe",
        {
          status: response.status,
          statusText: response.statusText,
          action: "SAFETY_CHECK_HTTP_FAILURE",
        },
      );
      return true;
    }

    const results = (await response.json()) as { id: string }[];

    if (results.length > 0) {
      console.error(
        "[CRITICAL] Test organization detected in production database!",
        {
          detectedOrg: results[0]?.id,
          testOrgIds: TEST_ORG_IDS,
          environment: process.env.NODE_ENV,
          timestamp: new Date().toISOString(),
          action: "DATABASE_CONTAMINATION_DETECTED",
        },
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error(
      "[CRITICAL] Production safety check failed - assuming unsafe",
      {
        error: error instanceof Error ? error.message : String(error),
        testOrgIds: TEST_ORG_IDS,
        action: "SAFETY_CHECK_FAILURE",
      },
    );
    return true; // Fail closed
  }
}

async function validateProductionSafety(): Promise<void> {
  // Skip check in non-production
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  cache.requestCount++;

  const now = Date.now();
  const shouldRecheck =
    cache.lastChecked === 0 ||
    cache.requestCount >= RECHECK_INTERVAL_REQUESTS ||
    now - cache.lastChecked >= RECHECK_INTERVAL_MS;

  if (!shouldRecheck) {
    if (cache.testOrgsDetected) {
      throw new Error(
        "Production database contains test data. Application locked for safety.",
      );
    }
    return;
  }

  const detected = await checkForTestOrganizations();
  cache.testOrgsDetected = detected;
  cache.lastChecked = now;
  cache.requestCount = 0;

  if (detected) {
    throw new Error(
      "Production database contains test data. Application locked. " +
        `Detected: ${TEST_ORG_IDS.join(", ")}`,
    );
  }
}

/**
 * Alpha Single-Org Middleware
 * Handles Supabase session refresh and production safety checks
 */
export async function middleware(request: NextRequest) {
  // CRITICAL: Check for test data contamination in production
  await validateProductionSafety();

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
