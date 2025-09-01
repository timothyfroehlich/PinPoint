// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

// Internal types (alphabetical)
import type {
  LocationResponse,
  LocationWithMachineDetails,
} from "~/lib/types/api";

// Internal utilities (alphabetical)
import { generateId } from "~/lib/utils/id-generation";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";

// Server modules (alphabetical)
import {
  createTRPCRouter,
  locationDeleteProcedure,
  locationEditProcedure,
  organizationManageProcedure,
  orgScopedProcedure,
  anonOrgScopedProcedure,
} from "~/server/api/trpc";

// Database schema (alphabetical)
import {
  issues,
  issueStatuses,
  locations,
  machines,
  models,
} from "~/server/db/schema";

export const locationRouter = createTRPCRouter({
  create: locationEditProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<LocationResponse> => {
      const [location] = await ctx.db
        .insert(locations)
        .values({
          id: generateId(),
          name: input.name,
          organization_id: ctx.organizationId,
        })
        .returning();

      return transformKeysToCamelCase(location) as LocationResponse;
    }),

  getAll: orgScopedProcedure.query(
    async ({ ctx }): Promise<LocationResponse[]> => {
      const allLocations = await ctx.db.query.locations.findMany({
        with: {
          machines: true,
        },
        orderBy: asc(locations.name),
      });

      return allLocations.map(
        (location) => transformKeysToCamelCase(location) as LocationResponse,
      );
    },
  ),

  // Public endpoint for unified dashboard - no authentication required
  getPublic: anonOrgScopedProcedure.query(
    async ({ ctx }): Promise<LocationWithMachineDetails[]> => {
      // Use single optimized query with JOINs instead of separate queries
      const result = await ctx.db
        .select({
          locationId: locations.id,
          locationName: locations.name,
          machineId: machines.id,
          machineName: machines.name,
          modelName: models.name,
          modelManufacturer: models.manufacturer,
          unresolvedIssueCount: sql<number>`count(case when ${issueStatuses.category} <> 'RESOLVED' then 1 end)`,
        })
        .from(locations)
        .leftJoin(machines, eq(machines.location_id, locations.id))
        .leftJoin(models, eq(models.id, machines.model_id))
        .leftJoin(issues, eq(issues.machine_id, machines.id))
        .leftJoin(issueStatuses, eq(issueStatuses.id, issues.status_id))
        .where(eq(locations.organization_id, ctx.organizationId))
        .groupBy(
          locations.id,
          locations.name,
          machines.id,
          machines.name,
          models.id,
          models.name,
          models.manufacturer,
        )
        .orderBy(asc(locations.name), asc(machines.id));

      // Transform flat result into nested structure
      const locationMap = new Map<string, LocationWithMachineDetails>();

      for (const row of result) {
        if (!locationMap.has(row.locationId)) {
          locationMap.set(row.locationId, {
            id: row.locationId,
            name: row.locationName,
            _count: { machines: 0 },
            machines: [],
          });
        }

        const location = locationMap.get(row.locationId);
        if (!location) continue;

        if (row.machineId) {
          const existingMachine = location.machines.find(
            (m) => m.id === row.machineId,
          );
          if (!existingMachine) {
            location.machines.push({
              id: row.machineId,
              name: row.machineName ?? "Unknown Machine",
              model: {
                name: row.modelName ?? "Unknown Model",
                manufacturer: row.modelManufacturer,
              },
              _count: {
                issues: row.unresolvedIssueCount || 0,
              },
            });
            location._count.machines++;
          }
        }
      }

      return Array.from(locationMap.values());
    },
  ),

  update: locationEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<LocationResponse> => {
      const updates: { name?: string; updated_at: Date } = {
        updated_at: new Date(),
      };
      if (input.name) {
        updates.name = input.name;
      }

      const [updatedLocation] = await ctx.db
        .update(locations)
        .set(updates)
        .where(eq(locations.id, input.id))
        .returning();

      if (!updatedLocation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Location not found or access denied",
        });
      }

      return transformKeysToCamelCase(updatedLocation) as LocationResponse;
    }),

  // Get a single location with detailed info
  getById: orgScopedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<LocationResponse> => {
      const location = await ctx.db.query.locations.findFirst({
        where: eq(locations.id, input.id),
        with: {
          machines: {
            orderBy: [asc(machines.id)],
            with: {
              model: true,
              owner: {
                columns: {
                  id: true,
                  name: true,
                  image: true,
                  profile_picture: true,
                },
              },
            },
          },
        },
      });

      if (!location) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Location not found or access denied",
        });
      }

      return transformKeysToCamelCase(location) as LocationResponse;
    }),

  delete: locationDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<LocationResponse> => {
      const [deletedLocation] = await ctx.db
        .delete(locations)
        .where(eq(locations.id, input.id))
        .returning();

      if (!deletedLocation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Location not found or access denied",
        });
      }

      return transformKeysToCamelCase(deletedLocation) as LocationResponse;
    }),

  // Admin-only PinballMap sync operations
  setPinballMapId: organizationManageProcedure
    .input(
      z.object({
        locationId: z.string(),
        pinballMapId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }): Promise<LocationResponse> => {
      const [updatedLocation] = await ctx.db
        .update(locations)
        .set({
          pinball_map_id: input.pinballMapId,
        })
        .where(eq(locations.id, input.locationId))
        .returning();

      if (!updatedLocation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Location not found or access denied",
        });
      }

      return transformKeysToCamelCase(updatedLocation) as LocationResponse;
    }),

  syncWithPinballMap: organizationManageProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<LocationResponse> => {
      const { locationId } = input;
      const pinballMapService = ctx.services.createPinballMapService();
      const sync = await pinballMapService.syncLocation(locationId);

      if (!sync.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: sync.error ?? "Sync failed",
        });
      }

      const refreshed = await ctx.db.query.locations.findFirst({
        where: eq(locations.id, locationId),
        with: { machines: true },
      });

      if (!refreshed) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Location not found after sync",
        });
      }

      return transformKeysToCamelCase(refreshed) as LocationResponse;
    }),
});
