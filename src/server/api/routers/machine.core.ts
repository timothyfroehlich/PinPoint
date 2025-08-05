import { TRPCError } from "@trpc/server";
import { eq, and, sql, asc } from "drizzle-orm";
import { z } from "zod";

import {
  createTRPCRouter,
  organizationProcedure,
  publicProcedure,
  machineEditProcedure,
  machineDeleteProcedure,
} from "~/server/api/trpc";
import { machines, models, locations, users } from "~/server/db/schema";

export const machineCoreRouter = createTRPCRouter({
  create: machineEditProcedure
    .input(
      z.object({
        name: z.string().optional(),
        modelId: z.string(),
        locationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // Verify that the model and location belong to the same organization

      // Prisma queries (current implementation)
      const prismaModel = await ctx.db.model.findFirst({
        where: {
          id: input.modelId,
        },
      });

      const prismaLocation = await ctx.db.location.findFirst({
        where: {
          id: input.locationId,
          organizationId: ctx.organization.id,
        },
      });

      // Drizzle queries (new implementation)
      const [drizzleModel] = await ctx.drizzle
        .select()
        .from(models)
        .where(eq(models.id, input.modelId))
        .limit(1);

      const [drizzleLocation] = await ctx.drizzle
        .select()
        .from(locations)
        .where(
          and(
            eq(locations.id, input.locationId),
            eq(locations.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      // Validation: Ensure both queries return equivalent results
      if (
        !!prismaModel !== !!drizzleModel ||
        !!prismaLocation !== !!drizzleLocation
      ) {
        console.error("MIGRATION WARNING: Model/Location validation differs", {
          prismaModel: !!prismaModel,
          drizzleModel: !!drizzleModel,
          prismaLocation: !!prismaLocation,
          drizzleLocation: !!drizzleLocation,
        });
      }

      if (!prismaModel || !prismaLocation) {
        throw new Error("Invalid game title or location");
      }

      // Prisma machine creation (current implementation)
      const prismaMachine = await ctx.db.machine.create({
        data: {
          name: input.name ?? prismaModel.name,
          modelId: input.modelId,
          locationId: input.locationId,
          organizationId: ctx.organization.id,
        },
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
                },
              },
            },
          },
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      // Drizzle machine creation (new implementation) with optimized joins
      const machineId = `machine_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`;
      const qrCodeId = `qr_${Date.now().toString()}_${Math.random().toString(36).substring(2, 11)}`;

      const [drizzleMachine] = await ctx.drizzle
        .insert(machines)
        .values({
          id: machineId,
          name: input.name ?? drizzleModel?.name ?? "Unknown Machine",
          modelId: input.modelId,
          locationId: input.locationId,
          organizationId: ctx.organization.id,
          qrCodeId: qrCodeId,
        })
        .returning();

      // Get machine with joins for comparison (used for future validation)
      await ctx.drizzle
        .select({
          machine: machines,
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
            ipdbId: models.ipdbId,
            opdbId: models.opdbId,
            machineType: models.machineType,
            machineDisplay: models.machineDisplay,
            isActive: models.isActive,
            ipdbLink: models.ipdbLink,
            opdbImgUrl: models.opdbImgUrl,
            kineticistUrl: models.kineticistUrl,
            isCustom: models.isCustom,
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines} 
              WHERE ${machines.modelId} = ${models.id}
            )`.as("machines_count"),
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, drizzleMachine?.id ?? ""))
        .limit(1);

      // Validation: Compare basic fields (complex joins would need detailed comparison)
      if (
        drizzleMachine &&
        (prismaMachine.id !== drizzleMachine.id ||
          prismaMachine.name !== drizzleMachine.name ||
          prismaMachine.modelId !== drizzleMachine.modelId ||
          prismaMachine.locationId !== drizzleMachine.locationId ||
          prismaMachine.organizationId !== drizzleMachine.organizationId)
      ) {
        console.error("MIGRATION WARNING: Machine creation results differ", {
          prisma: {
            id: prismaMachine.id,
            name: prismaMachine.name,
            modelId: prismaMachine.modelId,
            locationId: prismaMachine.locationId,
            organizationId: prismaMachine.organizationId,
          },
          drizzle: {
            id: drizzleMachine.id,
            name: drizzleMachine.name,
            modelId: drizzleMachine.modelId,
            locationId: drizzleMachine.locationId,
            organizationId: drizzleMachine.organizationId,
          },
        });
      }

      // Auto-generate QR code for the new machine
      try {
        const qrCodeService = ctx.services.createQRCodeService();

        await qrCodeService.generateQRCode(prismaMachine.id);
      } catch (error) {
        // Log error but don't fail machine creation
        ctx.logger.warn({
          msg: "Failed to generate QR code for machine",
          component: "machineRouter.create",
          context: {
            machineId: prismaMachine.id,
            machineName: prismaMachine.name,
            operation: "qr_code_generation",
          },
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzleMachineWithRelations after validation period
      return prismaMachine;
    }),

  getAll: organizationProcedure.query(async ({ ctx }) => {
    // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
    // This ensures exact functional parity before switching fully to Drizzle

    // Prisma query (current implementation)
    const prismaMachines = await ctx.db.machine.findMany({
      where: {
        organizationId: ctx.organization.id,
      },
      include: {
        model: true,
        location: true,
        owner: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: { model: { name: "asc" } },
    });

    // Drizzle query (new implementation) with optimized joins
    const drizzleMachines = await ctx.drizzle
      .select({
        machine: machines,
        model: models,
        location: locations,
        owner: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .innerJoin(locations, eq(machines.locationId, locations.id))
      .leftJoin(users, eq(machines.ownerId, users.id))
      .where(eq(machines.organizationId, ctx.organization.id))
      .orderBy(asc(models.name));

    // Validation: Ensure both queries return equivalent counts
    if (prismaMachines.length !== drizzleMachines.length) {
      console.error("MIGRATION WARNING: Machine getAll results count differs", {
        prismaCount: prismaMachines.length,
        drizzleCount: drizzleMachines.length,
      });
    }

    // Return Prisma result to maintain current behavior during parallel validation
    // TODO: Switch to drizzleMachines after validation period
    return prismaMachines;
  }),

  // Public endpoint for issue reporting - returns minimal data needed for issue form
  getAllForIssues: publicProcedure.query(async ({ ctx }) => {
    // Use the organization resolved from subdomain context
    const organization = ctx.organization;

    if (!organization) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }

    // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
    // This ensures exact functional parity before switching fully to Drizzle

    // Prisma query (current implementation)
    const prismaMachines = await ctx.db.machine.findMany({
      where: {
        organizationId: organization.id,
      },
      select: {
        id: true,
        name: true,
        model: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { model: { name: "asc" } },
    });

    // Drizzle query (new implementation) with selective fields
    const drizzleMachines = await ctx.drizzle
      .select({
        id: machines.id,
        name: machines.name,
        model: {
          name: models.name,
        },
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .where(eq(machines.organizationId, organization.id))
      .orderBy(asc(models.name));

    // Validation: Ensure both queries return equivalent counts
    if (prismaMachines.length !== drizzleMachines.length) {
      console.error(
        "MIGRATION WARNING: Machine getAllForIssues count differs",
        {
          prismaCount: prismaMachines.length,
          drizzleCount: drizzleMachines.length,
        },
      );
    }

    // Return Prisma result to maintain current behavior during parallel validation
    // TODO: Switch to drizzleMachines after validation period
    return prismaMachines;
  }),

  getById: organizationProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // Prisma query (current implementation)
      const prismaMachine = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
                },
              },
            },
          },
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      // Drizzle query (new implementation) with optimized joins
      const drizzleMachineResult = await ctx.drizzle
        .select({
          machine: machines,
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
            ipdbId: models.ipdbId,
            opdbId: models.opdbId,
            machineType: models.machineType,
            machineDisplay: models.machineDisplay,
            isActive: models.isActive,
            ipdbLink: models.ipdbLink,
            opdbImgUrl: models.opdbImgUrl,
            kineticistUrl: models.kineticistUrl,
            isCustom: models.isCustom,
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines} 
              WHERE ${machines.modelId} = ${models.id}
            )`.as("machines_count"),
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(
          and(
            eq(machines.id, input.id),
            eq(machines.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      const drizzleMachine = drizzleMachineResult[0];

      // Validation: Ensure both queries return equivalent results
      if (!!prismaMachine !== !!drizzleMachine) {
        console.error("MIGRATION WARNING: Machine getById existence differs", {
          prismaFound: !!prismaMachine,
          drizzleFound: !!drizzleMachine,
          machineId: input.id,
        });
      }

      if (!prismaMachine) {
        throw new Error("Game instance not found");
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzleMachine after validation period
      return prismaMachine;
    }),

  update: machineEditProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        modelId: z.string().optional(),
        locationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // First verify the game instance belongs to this organization

      // Prisma validation (current implementation)
      const prismaExistingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
      });

      // Drizzle validation (new implementation)
      const [drizzleExistingInstance] = await ctx.drizzle
        .select()
        .from(machines)
        .where(
          and(
            eq(machines.id, input.id),
            eq(machines.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      // Validation: Ensure both queries return equivalent results
      if (!!prismaExistingInstance !== !!drizzleExistingInstance) {
        console.error(
          "MIGRATION WARNING: Machine update existence check differs",
          {
            prismaFound: !!prismaExistingInstance,
            drizzleFound: !!drizzleExistingInstance,
            machineId: input.id,
          },
        );
      }

      if (!prismaExistingInstance) {
        throw new Error("Game instance not found");
      }

      // If updating model or location, verify they belong to the organization
      if (input.modelId) {
        // Prisma model validation
        const prismaModel = await ctx.db.model.findFirst({
          where: {
            id: input.modelId,
          },
        });

        // Drizzle model validation
        const [drizzleModel] = await ctx.drizzle
          .select()
          .from(models)
          .where(eq(models.id, input.modelId))
          .limit(1);

        // Validation comparison
        if (!!prismaModel !== !!drizzleModel) {
          console.error("MIGRATION WARNING: Model validation differs", {
            prismaFound: !!prismaModel,
            drizzleFound: !!drizzleModel,
            modelId: input.modelId,
          });
        }

        if (!prismaModel) {
          throw new Error("Invalid game title");
        }
      }

      if (input.locationId) {
        // Prisma location validation
        const prismaLocation = await ctx.db.location.findFirst({
          where: {
            id: input.locationId,
            organizationId: ctx.organization.id,
          },
        });

        // Drizzle location validation
        const [drizzleLocation] = await ctx.drizzle
          .select()
          .from(locations)
          .where(
            and(
              eq(locations.id, input.locationId),
              eq(locations.organizationId, ctx.organization.id),
            ),
          )
          .limit(1);

        // Validation comparison
        if (!!prismaLocation !== !!drizzleLocation) {
          console.error("MIGRATION WARNING: Location validation differs", {
            prismaFound: !!prismaLocation,
            drizzleFound: !!drizzleLocation,
            locationId: input.locationId,
          });
        }

        if (!prismaLocation) {
          throw new Error("Invalid location");
        }
      }

      // Prepare update data
      const updateData: {
        name?: string;
        modelId?: string;
        locationId?: string;
      } = {};
      if (input.name) updateData.name = input.name;
      if (input.modelId) updateData.modelId = input.modelId;
      if (input.locationId) updateData.locationId = input.locationId;

      // Prisma update (current implementation)
      const prismaUpdatedMachine = await ctx.db.machine.update({
        where: { id: input.id },
        data: updateData,
        include: {
          model: {
            include: {
              _count: {
                select: {
                  machines: true,
                },
              },
            },
          },
          location: true,
          owner: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      });

      // Drizzle update (new implementation)
      const [drizzleUpdatedMachine] = await ctx.drizzle
        .update(machines)
        .set(updateData)
        .where(eq(machines.id, input.id))
        .returning();

      // Get updated machine with joins for validation (used for future validation)
      await ctx.drizzle
        .select({
          machine: machines,
          model: {
            id: models.id,
            name: models.name,
            manufacturer: models.manufacturer,
            year: models.year,
            ipdbId: models.ipdbId,
            opdbId: models.opdbId,
            machineType: models.machineType,
            machineDisplay: models.machineDisplay,
            isActive: models.isActive,
            ipdbLink: models.ipdbLink,
            opdbImgUrl: models.opdbImgUrl,
            kineticistUrl: models.kineticistUrl,
            isCustom: models.isCustom,
            machinesCount: sql<number>`(
              SELECT COUNT(*) FROM ${machines} 
              WHERE ${machines.modelId} = ${models.id}
            )`.as("machines_count"),
          },
          location: locations,
          owner: {
            id: users.id,
            name: users.name,
            image: users.image,
          },
        })
        .from(machines)
        .innerJoin(models, eq(machines.modelId, models.id))
        .innerJoin(locations, eq(machines.locationId, locations.id))
        .leftJoin(users, eq(machines.ownerId, users.id))
        .where(eq(machines.id, input.id))
        .limit(1);

      // Validation: Compare basic fields
      if (
        drizzleUpdatedMachine &&
        (prismaUpdatedMachine.id !== drizzleUpdatedMachine.id ||
          prismaUpdatedMachine.name !== drizzleUpdatedMachine.name ||
          prismaUpdatedMachine.modelId !== drizzleUpdatedMachine.modelId ||
          prismaUpdatedMachine.locationId !== drizzleUpdatedMachine.locationId)
      ) {
        console.error("MIGRATION WARNING: Machine update results differ", {
          prisma: {
            id: prismaUpdatedMachine.id,
            name: prismaUpdatedMachine.name,
            modelId: prismaUpdatedMachine.modelId,
            locationId: prismaUpdatedMachine.locationId,
          },
          drizzle: {
            id: drizzleUpdatedMachine.id,
            name: drizzleUpdatedMachine.name,
            modelId: drizzleUpdatedMachine.modelId,
            locationId: drizzleUpdatedMachine.locationId,
          },
        });
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzleUpdatedWithRelations after validation period
      return prismaUpdatedMachine;
    }),

  delete: machineDeleteProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // PARALLEL VALIDATION: Execute both Prisma and Drizzle queries during migration
      // This ensures exact functional parity before switching fully to Drizzle

      // Verify the game instance belongs to this organization

      // Prisma validation (current implementation)
      const prismaExistingInstance = await ctx.db.machine.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.organization.id,
        },
      });

      // Drizzle validation (new implementation)
      const [drizzleExistingInstance] = await ctx.drizzle
        .select()
        .from(machines)
        .where(
          and(
            eq(machines.id, input.id),
            eq(machines.organizationId, ctx.organization.id),
          ),
        )
        .limit(1);

      // Validation: Ensure both queries return equivalent results
      if (!!prismaExistingInstance !== !!drizzleExistingInstance) {
        console.error(
          "MIGRATION WARNING: Machine delete existence check differs",
          {
            prismaFound: !!prismaExistingInstance,
            drizzleFound: !!drizzleExistingInstance,
            machineId: input.id,
          },
        );
      }

      if (!prismaExistingInstance) {
        throw new Error("Game instance not found");
      }

      // Prisma delete (current implementation)
      const prismaDeleteResult = await ctx.db.machine.delete({
        where: { id: input.id },
      });

      // Drizzle delete (new implementation)
      const drizzleDeleteResult = await ctx.drizzle
        .delete(machines)
        .where(eq(machines.id, input.id))
        .returning();

      // Validation: Ensure both deletes affected the same machine
      if (
        drizzleDeleteResult.length > 0 &&
        prismaDeleteResult.id !== drizzleDeleteResult[0]?.id
      ) {
        console.error("MIGRATION WARNING: Machine delete results differ", {
          prismaDeleted: prismaDeleteResult.id,
          drizzleDeleted: drizzleDeleteResult[0]?.id,
        });
      }

      // Return Prisma result to maintain current behavior during parallel validation
      // TODO: Switch to drizzleDeleteResult[0] after validation period
      return prismaDeleteResult;
    }),
});
