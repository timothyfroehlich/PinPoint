// External libraries (alphabetical)
import { TRPCError } from "@trpc/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";

// Internal types (alphabetical)
import type { ModelResponse } from "~/lib/types/api";
import type { OPDBSearchResult } from "~/lib/types";

// Internal utilities (alphabetical)
import { env } from "~/env";
import { generateId } from "~/lib/utils/id-generation";
import { transformKeysToCamelCase } from "~/lib/utils/case-transformers";
import { OPDBClient } from "~/lib/opdb/client";

// Server modules (alphabetical)
import {
  createTRPCRouter,
  organizationManageProcedure,
  orgScopedProcedure,
} from "~/server/api/trpc";

// Database schema (alphabetical)
import { machines, models } from "~/server/db/schema";
import { type Model } from "~/server/db/types";

export const modelRouter = createTRPCRouter({
  // Get all models accessible to this organization
  // Includes: commercial models (global) + org's custom models (future v1.x feature)
  getAll: orgScopedProcedure.query(
    async ({ ctx }): Promise<ModelResponse[]> => {
      const allModels = await ctx.db.query.models.findMany({
        where:
          // Global commercial models (organizationId = NULL) OR org's custom models
          or(
            isNull(models.organization_id), // Commercial models
            eq(models.organization_id, ctx.organizationId), // Custom models
          ),
        with: {
          machines: {
            where: eq(machines.organization_id, ctx.organizationId),
            columns: { id: true },
          },
        },
      });

      // Add machine count and sort by name
      return allModels
        .map((m) => {
          const { machines, ...base } = m;
          const count = machines.length;
          const transformed = transformKeysToCamelCase({
            ...base,
            machineCount: count,
            _count: { machines: count },
          });
          return transformed as ModelResponse;
        })
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  ),

  // Get single model by ID (must be accessible to organization)
  getById: orgScopedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<ModelResponse> => {
      const model = await ctx.db.query.models.findFirst({
        where: and(
          eq(models.id, input.id),
          // Must be commercial model OR org's custom model
          or(
            isNull(models.organization_id), // Commercial models
            eq(models.organization_id, ctx.organizationId), // Custom models
          ),
        ),
        with: {
          machines: {
            where: (m, { eq }) => eq(m.organization_id, ctx.organizationId),
            columns: { id: true },
          },
        },
      });

      if (!model) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found or access denied",
        });
      }

      // Return model with machine count
      const { machines, ...base } = model;
      const count = machines.length;
      const transformed = transformKeysToCamelCase({
        ...base,
        machineCount: count,
        _count: { machines: count },
      });
      return transformed as ModelResponse;
    }),

  // Search commercial games for typeahead
  searchOPDB: orgScopedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }): Promise<OPDBSearchResult[]> => {
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      return await opdbClient.searchMachines(input.query);
    }),

  // Create Model from OPDB data
  createFromOPDB: organizationManageProcedure
    .input(z.object({ opdbId: z.string() }))
    .mutation(async ({ ctx, input }): Promise<Model> => {
      // Check if this commercial game already exists globally
      const existingGame = await ctx.db.query.models.findFirst({
        where: and(
          eq(models.opdb_id, input.opdbId),
          isNull(models.organization_id), // Commercial models have NULL organizationId
        ),
      });

      if (existingGame) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This game already exists in the system",
        });
      }

      // Fetch full data from OPDB
      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      const machineData = await opdbClient.getMachineById(input.opdbId);

      if (!machineData) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Model not found in OPDB",
        });
      }

      // Create global commercial Model record
      // Commercial games are shared across all organizations
      const [newModel] = await ctx.db
        .insert(models)
        .values({
          id: generateId(),
          name: machineData.name,
          organization_id: null, // NULL for commercial models (global access)
          is_custom: false, // Commercial models are not custom
          opdb_id: input.opdbId,
          manufacturer: machineData.manufacturer ?? null,
          year: machineData.year ?? null,
          opdb_img_url: machineData.playfield_image ?? null,
          machine_type: machineData.type ?? null,
        })
        .returning();

      if (!newModel) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create model",
        });
      }

      return newModel;
    }),

  // Sync existing commercial models with latest OPDB data
  syncWithOPDB: organizationManageProcedure.mutation(
    async ({
      ctx,
    }): Promise<{ synced: number; total?: number; message: string }> => {
      // Find all commercial models that have machines in this organization
      const machinesInOrg = await ctx.db.query.machines.findMany({
        where: eq(machines.organization_id, ctx.organizationId),
        with: {
          model: true,
        },
      });

      // Extract and filter commercial models from machines
      const commercialModelsToSync = machinesInOrg
        .map((machine) => machine.model)
        .filter(
          (model) =>
            model.opdb_id != null &&
            model.organization_id === null && // Only commercial models
            !model.is_custom,
        )
        // Remove duplicates by creating a Map
        .reduce((uniqueModels, model) => {
          uniqueModels.set(model.id, model);
          return uniqueModels;
        }, new Map<string, NonNullable<(typeof machinesInOrg)[0]["model"]>>());

      const uniqueModels = Array.from(commercialModelsToSync.values());

      if (uniqueModels.length === 0) {
        return { synced: 0, message: "No commercial games found to sync" };
      }

      const opdbClient = new OPDBClient(env.OPDB_API_KEY, env.OPDB_API_URL);
      let syncedCount = 0;

      // Sync each title with OPDB data
      for (const title of uniqueModels) {
        try {
          if (!title.opdb_id) continue; // Type guard

          const machineData = await opdbClient.getMachineById(title.opdb_id);

          if (machineData) {
            await ctx.db
              .update(models)
              .set({
                name: machineData.name,
                manufacturer: machineData.manufacturer ?? null,
                year: machineData.year ?? null,
                opdb_img_url: machineData.playfield_image ?? null,
                machine_type: machineData.type ?? null,
              })
              .where(eq(models.id, title.id));
            syncedCount++;
          }
        } catch (error) {
          ctx.logger.error({
            msg: "Failed to sync commercial game",
            component: "modelRouter.syncCommercialGames",
            context: {
              gameTitle: title.name,
              gameId: title.id,
              opdbId: title.opdb_id,
              operation: "opdb_sync",
            },
            error: {
              message: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      return {
        synced: syncedCount,
        total: uniqueModels.length,
        message: `Synced ${String(syncedCount)} of ${String(uniqueModels.length)} games`,
      };
    },
  ),

  // Note: Custom model CRUD operations will be added in v1.x
  // For now, commercial models are read-only after creation and cannot be deleted
});
