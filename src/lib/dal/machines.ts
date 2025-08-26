/**
 * Machines Data Access Layer
 * Direct database queries for Server Components
 */

import { cache } from "react";
import { and, desc, eq } from "drizzle-orm";
import { machines } from "~/server/db/schema";
import { db, requireAuthContext } from "./shared";

/**
 * Get all machines for the current organization
 * Includes location and model information
 * Uses React 19 cache() for request-level memoization
 */
export const getMachinesForOrg = cache(async () => {
  const { organizationId } = await requireAuthContext();
  
  return await db.query.machines.findMany({
    where: eq(machines.organization_id, organizationId),
    orderBy: [desc(machines.created_at)]
  });
});

/**
 * Get single machine by ID with full details
 * Enforces organization scoping
 * Uses React 19 cache() for request-level memoization per machineId
 */
export const getMachineById = cache(async (machineId: string) => {
  const { organizationId } = await requireAuthContext();
  
  const machine = await db.query.machines.findFirst({
    where: and(
      eq(machines.id, machineId),
      eq(machines.organization_id, organizationId)
    )
  });
  
  if (!machine) {
    throw new Error("Machine not found or access denied");
  }
  
  return machine;
});

/**
 * Get machines with issue counts for overview
 * Useful for machine management dashboard
 * Benefits from getMachinesForOrg() React 19 cache()
 */
export async function getMachinesWithIssueCounts() {
  // For now, return basic machines - can enhance with issue counts later
  return await getMachinesForOrg();
}