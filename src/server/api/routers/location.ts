import { TRPCError } from "@trpc/server";
import { and, count, eq, ne } from "drizzle-orm";
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
import { locations, machines, issues, issueStatuses } from "~/server/db/schema";

export const locationRouter = createTRPCRouter({
  create: locationEditProcedure
    .input(
      z.object({
        name: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [location] = await ctx.drizzle
        .insert(locations)
        .values({
          id: generateId(),
          name: input.name,
          organizationId: ctx.organization.id,
        })
        .returning();

      return location;
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    return await ctx.drizzle.query.locations.findMany({
      where: eq(locations.organizationId, ctx.organization.id),
      with: {
        machines: true,
      },
      orderBy: locations.name,
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

    // Get locations with machines and models
    const locationsWithMachines = await ctx.drizzle.query.locations.findMany({
      where: eq(locations.organizationId, ctx.organization.id),
      columns: {
        id: true,
        name: true,
      },
      with: {
        machines: {
          columns: {
            id: true,
            name: true,
          },
          with: {
            model: {
              columns: {
                name: true,
                manufacturer: true,
              },
            },
          },
        },
      },
      orderBy: locations.name,
    });

    // Get machine counts for each location
    const machineCountsQuery = await ctx.drizzle
      .select({
        locationId: machines.locationId,
        machineCount: count(),
      })
      .from(machines)
      .where(eq(machines.organizationId, ctx.organization.id))
      .groupBy(machines.locationId);

    const machineCountsMap = new Map(
      machineCountsQuery.map((row) => [row.locationId, row.machineCount]),
    );

    // Get unresolved issue counts for each machine
    const unresolvedIssueCountsQuery = await ctx.drizzle
      .select({
        machineId: issues.machineId,
        issueCount: count(),
      })
      .from(issues)
      .innerJoin(issueStatuses, eq(issues.statusId, issueStatuses.id))
      .where(
        and(
          eq(issues.organizationId, ctx.organization.id),
          ne(issueStatuses.category, "RESOLVED"),
        ),
      )
      .groupBy(issues.machineId);

    const unresolvedIssueCountsMap = new Map(
      unresolvedIssueCountsQuery.map((row) => [row.machineId, row.issueCount]),
    );

    // Combine data
    return locationsWithMachines.map((location) => ({
      ...location,
      _count: {
        machines: machineCountsMap.get(location.id) ?? 0,
      },
      machines: location.machines.map((machine) => ({
        ...machine,
        _count: {
          issues: unresolvedIssueCountsMap.get(machine.id) ?? 0,
        },
      })),
    }));
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

      const [updatedLocation] = await ctx.drizzle
        .update(locations)
        .set(updates)
        .where(
          and(
            eq(locations.id, input.id),
            eq(locations.organizationId, ctx.organization.id), // Ensure user can only update their org's locations
          ),
        )
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
      const location = await ctx.drizzle.query.locations.findFirst({
        where: and(
          eq(locations.id, input.id),
          eq(locations.organizationId, ctx.organization.id),
        ),
        with: {
          machines: {
            with: {
              model: true,
              owner: {
                columns: {
                  id: true,
                  name: true,
                  profilePicture: true, // Note: using profilePicture instead of image based on schema
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
      const [deletedLocation] = await ctx.drizzle
        .delete(locations)
        .where(
          and(
            eq(locations.id, input.id),
            eq(locations.organizationId, ctx.organization.id), // Ensure user can only delete their org's locations
          ),
        )
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
      const [updatedLocation] = await ctx.drizzle
        .update(locations)
        .set({
          pinballMapId: input.pinballMapId,
        })
        .where(
          and(
            eq(locations.id, input.locationId),
            eq(locations.organizationId, ctx.organization.id),
          ),
        )
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
