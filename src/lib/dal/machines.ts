/**
 * Machines Data Access Layer
 * Direct database queries for Server Components
 * Phase 3B: Enhanced with filtering, search, and pagination capabilities
 */

import { cache } from "react";
import {
  and,
  desc,
  eq,
  or,
  count,
  sql,
  asc,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";
import { machines, locations, models } from "~/server/db/schema";
// No direct db access; use ensureOrgContextAndBindRLS to run under RLS-bound tx
import { ensureOrgContextAndBindRLS } from "~/lib/organization-context";

// ================================
// TYPE DEFINITIONS
// ================================

export interface MachineFilters {
  locationIds?: string[] | undefined;
  modelIds?: string[] | undefined;
  ownerIds?: string[] | undefined;
  search?: string | undefined;
  hasQR?: boolean | undefined;
}

export interface MachinePagination {
  page: number;
  limit: number;
}

export interface MachineSorting {
  field: "name" | "created_at" | "updated_at" | "location" | "model";
  order: "asc" | "desc";
}

export interface MachineStats {
  total: number;
  withQR: number;
  byLocation: {
    locationId: string;
    locationName: string;
    count: number;
  }[];
  byModel: {
    modelId: string;
    modelName: string;
    count: number;
  }[];
}

// ================================
// CORE MACHINE QUERIES
// ================================

/**
 * Get machines with comprehensive filtering, pagination, and search
 * Primary function for machine inventory with Server Component optimization
 * Uses React 19 cache() for request-level memoization
 */
export const getMachinesWithFilters = cache(
  async (
    filters: MachineFilters = {},
    pagination: MachinePagination = { page: 1, limit: 20 },
    sorting: MachineSorting = { field: "created_at", order: "desc" },
  ) => {
    return ensureOrgContextAndBindRLS(async (tx, context) => {
      const organizationId = context.organization.id;
      const offset = (pagination.page - 1) * pagination.limit;

      // Build where conditions
      const whereConditions: SQL[] = [
        eq(machines.organization_id, organizationId),
        isNull(machines.deleted_at), // Exclude soft-deleted machines per §9.3
      ];

    // Location filtering
    if (filters.locationIds?.length) {
      whereConditions.push(inArray(machines.location_id, filters.locationIds));
    }

    // Model filtering
    if (filters.modelIds?.length) {
      whereConditions.push(inArray(machines.model_id, filters.modelIds));
    }

    // Owner filtering
    if (filters.ownerIds?.length) {
      whereConditions.push(inArray(machines.owner_id, filters.ownerIds));
    }

    // QR code filtering
    if (filters.hasQR === true) {
      whereConditions.push(sql`${machines.qr_code_url} IS NOT NULL`);
    } else if (filters.hasQR === false) {
      whereConditions.push(sql`${machines.qr_code_url} IS NULL`);
    }

    // Search across machine name, location name, and model name
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      whereConditions.push(
        sql`(
          ${machines.name} ILIKE ${searchTerm}
          OR EXISTS (
            SELECT 1 FROM ${locations} 
            WHERE ${locations.id} = ${machines.location_id} 
            AND ${locations.name} ILIKE ${searchTerm}
          )
          OR EXISTS (
            SELECT 1 FROM ${models} 
            WHERE ${models.id} = ${machines.model_id} 
            AND ${models.name} ILIKE ${searchTerm}
          )
        )`
      );
    }

    // Build order by
    let orderBy;
    switch (sorting.field) {
      case "name":
        orderBy =
          sorting.order === "desc" ? desc(machines.name) : asc(machines.name);
        break;
      case "updated_at":
        orderBy =
          sorting.order === "desc"
            ? desc(machines.updated_at)
            : asc(machines.updated_at);
        break;
      case "location":
        // Complex sorting by location name - we'll use a subquery
        orderBy =
          sorting.order === "desc"
            ? sql`(SELECT ${locations.name} FROM ${locations} WHERE ${locations.id} = ${machines.location_id}) DESC`
            : sql`(SELECT ${locations.name} FROM ${locations} WHERE ${locations.id} = ${machines.location_id}) ASC`;
        break;
      case "model":
        // Complex sorting by model name - we'll use a subquery
        orderBy =
          sorting.order === "desc"
            ? sql`(SELECT ${models.name} FROM ${models} WHERE ${models.id} = ${machines.model_id}) DESC`
            : sql`(SELECT ${models.name} FROM ${models} WHERE ${models.id} = ${machines.model_id}) ASC`;
        break;
      default:
        orderBy =
          sorting.order === "desc"
            ? desc(machines.created_at)
            : asc(machines.created_at);
    }

      // Execute queries in parallel
      const [machineResults, totalCountResult] = await Promise.all([
        // Get machines with relations
        tx.query.machines.findMany({
          where: and(...whereConditions),
          with: {
            location: {
              columns: { id: true, name: true, city: true, state: true },
            },
            model: {
              columns: { id: true, name: true, manufacturer: true, year: true },
            },
          },
          limit: pagination.limit + 1, // +1 to check if there's a next page
          offset,
          orderBy: [orderBy],
        }),

        // Get total count
        tx
          .select({ count: count() })
          .from(machines)
          .where(and(...whereConditions))
          .then((result) => result[0]?.count ?? 0),
      ]);

    const hasNextPage = machineResults.length > pagination.limit;
    const items = hasNextPage ? machineResults.slice(0, -1) : machineResults;

      return {
        items,
        totalCount: totalCountResult,
        hasNextPage,
        currentPage: pagination.page,
        totalPages: Math.ceil(totalCountResult / pagination.limit),
      };
    });
  },
);

/**
 * Get all machines for the current organization (simple version)
 * Includes location and model information
 * Uses React 19 cache() for request-level memoization
 */
export const getMachinesForOrg = cache(async () => {
  return await getMachinesWithFilters();
});

/**
 * Get single machine by ID with full details
 * Enforces organization scoping
 * Uses React 19 cache() for request-level memoization per machineId
 */
export const getMachineById = cache(async (machineId: string) => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    const machine = await tx.query.machines.findFirst({
      where: and(
        eq(machines.id, machineId),
        eq(machines.organization_id, organizationId),
        isNull(machines.deleted_at), // Exclude soft-deleted machines per §9.3
      ),
      with: {
        location: {
          columns: {
            id: true,
            name: true,
            city: true,
            state: true,
            street: true,
          },
        },
        model: {
          columns: {
            id: true,
            name: true,
            manufacturer: true,
            year: true,
            machine_type: true,
            machine_display: true,
          },
        },
      },
    });

    if (!machine) {
      throw new Error("Machine not found or access denied");
    }

    return machine;
  });
});

/**
 * Get machine statistics for organization dashboard
 * Includes counts by location, model, and QR code status
 * Uses React 19 cache() for request-level memoization
 */
export const getMachineStats = cache(async (): Promise<MachineStats> => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;

    // Get basic counts
    const [totalMachines, machinesWithQR, byLocation, byModel] =
      await Promise.all([
        // Total machine count
        tx
          .select({ count: count() })
          .from(machines)
          .where(eq(machines.organization_id, organizationId))
          .then((result) => result[0]?.count ?? 0),

        // Machines with QR codes
        tx
          .select({ count: count() })
          .from(machines)
          .where(
            and(
              eq(machines.organization_id, organizationId),
              sql`${machines.qr_code_url} IS NOT NULL`,
            ),
          )
          .then((result) => result[0]?.count ?? 0),

        // Machines by location
        tx
          .select({
            locationId: machines.location_id,
            locationName: locations.name,
            count: count(),
          })
          .from(machines)
          .leftJoin(locations, eq(machines.location_id, locations.id))
          .where(eq(machines.organization_id, organizationId))
          .groupBy(machines.location_id, locations.name),

        // Machines by model
        tx
          .select({
            modelId: machines.model_id,
            modelName: models.name,
            count: count(),
          })
          .from(machines)
          .leftJoin(models, eq(machines.model_id, models.id))
          .where(eq(machines.organization_id, organizationId))
          .groupBy(machines.model_id, models.name),
      ]);

    return {
      total: totalMachines,
      withQR: machinesWithQR,
      byLocation: byLocation.map((item) => ({
        locationId: item.locationId,
        locationName: item.locationName ?? "Unknown Location",
        count: item.count,
      })),
      byModel: byModel.map((item) => ({
        modelId: item.modelId,
        modelName: item.modelName ?? "Unknown Model",
        count: item.count,
      })),
    };
  });
});

/**
 * Get locations for the current organization (for filters)
 * Uses React 19 cache() for request-level memoization
 */
export const getLocationsForOrg = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    return await tx.query.locations.findMany({
      where: eq(locations.organization_id, organizationId),
      columns: { id: true, name: true, city: true, state: true },
      orderBy: [asc(locations.name)],
    });
  });
});

/**
 * Get models available for the current organization (for filters)
 * Includes both global commercial models and org-specific custom models
 * Uses React 19 cache() for request-level memoization
 */
export const getModelsForOrg = cache(async () => {
  return ensureOrgContextAndBindRLS(async (tx, context) => {
    const organizationId = context.organization.id;
    return await tx.query.models.findMany({
      where: or(
        sql`${models.organization_id} IS NULL`, // Global commercial models
        eq(models.organization_id, organizationId), // Org-specific custom models
      ),
      columns: {
        id: true,
        name: true,
        manufacturer: true,
        year: true,
        is_custom: true,
      },
      orderBy: [asc(models.manufacturer), asc(models.name)],
    });
  });
});

/**
 * Get machines with issue counts for overview
 * Useful for machine management dashboard
 * Benefits from getMachinesForOrg() React 19 cache()
 */
export async function getMachinesWithIssueCounts(): Promise<
  Awaited<ReturnType<typeof getMachinesForOrg>>
> {
  // For now, return basic machines - can enhance with issue counts later
  return await getMachinesForOrg();
}
