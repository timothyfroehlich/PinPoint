import { TRPCError } from "@trpc/server";
import { eq, asc, sql } from "drizzle-orm";
import { z } from "zod";

import { generateId } from "~/lib/utils/id-generation";
import {
  createTRPCRouter,
  publicProcedure,
  organizationProcedure,
  locationEditProcedure,
  locationDeleteProcedure,
  organizationManageProcedure,
} from "~/server/api/trpc";
import {
  locations,
  machines,
  issues,
  issueStatuses,
  models,
} from "~/server/db/schema";

export const locationRouter = createTRPCRouter({
  create: locationEditProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [location] = await ctx.db
        .insert(locations)
        .values({
          id: generateId(),
          name: input.name,
        })
        .returning();

      return location;
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.locations.findMany({
      with: {
        machines: true,
      },
      orderBy: asc(locations.name),
    });
  }),

  // Public endpoint for unified dashboard - no authentication required
  getPublic: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

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
      .leftJoin(machines, eq(machines.locationId, locations.id))
      .innerJoin(models, eq(models.id, machines.modelId))
      .leftJoin(issues, eq(issues.machineId, machines.id))
      .leftJoin(issueStatuses, eq(issueStatuses.id, issues.statusId))
      .where(sql`1=1`)
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
    interface LocationWithMachines {
      id: string;
      name: string;
      _count: { machines: number };
      machines: {
        id: string;
        name: string;
        model: {
          name: string;
          manufacturer: string | null;
        };
        _count: { issues: number };
      }[];
    }

    const locationMap = new Map<string, LocationWithMachines>();

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
              name: row.modelName,
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
  }),

  update: locationEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updates: { name?: string; updatedAt: Date } = {
        updatedAt: new Date(),
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

      return updatedLocation;
    }),

  // Get a single location with detailed info
  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
                  profilePicture: true,
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

      return location;
    }),

  delete: locationDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
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

      return deletedLocation;
    }),

  // Admin-only PinballMap sync operations
  setPinballMapId: organizationManageProcedure
    .input(
      z.object({
        locationId: z.string(),
        pinballMapId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updatedLocation] = await ctx.db
        .update(locations)
        .set({
          pinballMapId: input.pinballMapId,
        })
        .where(eq(locations.id, input.locationId))
        .returning();

      if (!updatedLocation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Location not found or access denied",
        });
      }

      return updatedLocation;
    }),

  syncWithPinballMap: organizationManageProcedure
    .input(z.object({ locationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pinballMapService = ctx.services.createPinballMapService();
      const result = await pinballMapService.syncLocation(input.locationId);

      if (!result.success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error ?? "Sync failed",
        });
      }

      return result;
    }),
});
