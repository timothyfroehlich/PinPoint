/**
 * Public Machines Data Access Layer
 * Machine queries that don't require authentication
 * Used for anonymous issue reporting and public machine information
 */

import "server-only";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { machines, organizations } from "~/server/db/schema";
import { calculateEffectiveMachineVisibility } from "~/lib/utils/visibility-inheritance";
import { getDb } from "./shared";

/**
 * Machine data structure for public display
 */
export interface PublicMachine {
  id: string;
  name: string;
  model: {
    id: string;
    name: string;
    manufacturer: string | null;
    year: number | null;
  };
  location: {
    id: string;
    name: string;
  };
}

/**
 * Get machine by ID for public access (anonymous issue reporting)
 * Validates that machine allows anonymous issues and is publicly accessible
 * Uses React 19 cache() for request-level memoization
 */
export const getPublicMachineById = cache(
  async (machineId: string): Promise<PublicMachine | null> => {
    if (!machineId) {
      return null;
    }

    const db = getDb();
    const machineRecord = await db.query.machines.findFirst({
      where: eq(machines.id, machineId),
      with: {
        location: true,
        model: true,
      },
    });

    if (!machineRecord) {
      return null;
    }

    // SECURITY: Validate organization visibility settings
    // Organization must be public AND allow anonymous issues
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, machineRecord.location.organization_id),
      columns: {
        is_public: true,
        allow_anonymous_issues: true,
      },
    });

    if (!org) {
      return null;
    }

    if (!org.is_public || !org.allow_anonymous_issues) {
      return null;
    }

    const effectiveMachineVisibility = calculateEffectiveMachineVisibility(
      { is_public: org.is_public },
      { is_public: machineRecord.location.is_public },
      { is_public: machineRecord.is_public },
    );

    if (!effectiveMachineVisibility) {
      return null;
    }

    // Transform to the expected format for the report page
    return {
      id: machineRecord.id,
      name: machineRecord.name,
      model: {
        id: machineRecord.model_id,
        name: machineRecord.model.name,
        manufacturer: machineRecord.model.manufacturer ?? null,
        year: machineRecord.model.year ?? null,
      },
      location: {
        id: machineRecord.location_id,
        name: machineRecord.location.name || "Location",
      },
    };
  },
);

/**
 * Validate that a machine exists and is accessible for public reporting
 * Used for form validation and security checks
 * Uses React 19 cache() for request-level memoization
 */
export const validatePublicMachineExists = cache(
  async (machineId: string): Promise<boolean> => {
    try {
      const db = getDb();
      const machine = await db.query.machines.findFirst({
        where: eq(machines.id, machineId),
        columns: {
          id: true,
        },
      });

      return !!machine;
    } catch (error) {
      console.error("Error validating machine:", error);
      return false;
    }
  },
);
