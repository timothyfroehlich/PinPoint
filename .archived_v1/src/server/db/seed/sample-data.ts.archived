/**
 * Sample Data Seeding - Unified with Shared Utilities
 *
 * Creates machines and sample issues using pure Drizzle queries.
 * Uses standardized error handling, logging, and patterns.
 *
 * Note: This file uses snake_case field names for database operations
 * to match the actual database schema. Any transformation between camelCase
 * and snake_case should be handled at the application boundary.
 */

// Node modules
import { eq, and, inArray } from "drizzle-orm";

// Internal utilities
import { createDrizzleClient } from "~/server/db/drizzle";
import { SEED_TEST_IDS } from "./constants";
import {
  SeedLogger,
  withErrorContext,
  createSeedResult,
  createFailedSeedResult,
  type SeedResult,
} from "./seed-utilities";

// Schema imports
import { models, machines, issues, users, locations } from "~/server/db/schema";

// Local imports
import minimalIssues from "./minimal-issues";
import fullIssues from "./full-issues";

const db = createDrizzleClient();

// ============================================================================
// Types & Interfaces
// ============================================================================

type DataAmount = "minimal" | "full";

interface UniqueGame {
  opdbId: string;
  name: string;
  manufacturer?: string | undefined;
  year?: number | undefined;
}

interface SampleDataResult {
  gamesCreated: number;
  machinesCreated: number;
  issuesCreated: number;
}

// ============================================================================
// Game Data Extraction
// ============================================================================

/**
 * Extract unique games from TypeScript issue data
 */
function extractUniqueGames(dataAmount: DataAmount): UniqueGame[] {
  const issueData = dataAmount === "minimal" ? minimalIssues : fullIssues;

  if (issueData.length === 0) {
    return [];
  }

  // Known machine to game mapping from SEED_TEST_IDS
  const knownGames: UniqueGame[] = [
    {
      opdbId: "GBLLd-MdEON-A94po",
      name: "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
      manufacturer: "Stern",
    },
    { opdbId: "G42Pk-MZe2e", name: "Xenon", manufacturer: "Bally" },
    { opdbId: "GrknN-MQrdv", name: "Cleopatra", manufacturer: "Gottlieb" },
    {
      opdbId: "G50Wr-MLeZP",
      name: "Revenge from Mars",
      manufacturer: "Williams",
    },
    {
      opdbId: "GR6d8-M1rZd",
      name: "Star Trek: The Next Generation",
      manufacturer: "Stern",
    },
    {
      opdbId: "GrqZX-MD15w",
      name: "Lord of the Rings",
      manufacturer: "Stern",
    },
    { opdbId: "G5n2D-MLn85", name: "Transporter the Rescue" },
  ];

  return knownGames;
}

// ============================================================================
// Model Management
// ============================================================================

/**
 * Create OPDB models with unified error handling
 */
async function createModels(games: UniqueGame[]): Promise<void> {
  if (games.length === 0) {
    return;
  }

  const modelsToCreate: (typeof models.$inferInsert)[] = games.map((game) => ({
    id: `model_${game.opdbId}`,
    name: game.name,
    manufacturer: game.manufacturer,
    year: game.year,
    opdb_id: game.opdbId,
    is_active: true,
  }));

  // Check existing models
  const opdbIds = modelsToCreate
    .map((m) => m.opdb_id)
    .filter((id): id is string => id !== null && id !== undefined);

  const existingModelOpdbIds =
    opdbIds.length > 0
      ? await db
          .select({ opdb_id: models.opdb_id })
          .from(models)
          .where(inArray(models.opdb_id, opdbIds))
      : [];

  const existingOpdbIdSet = new Set(
    existingModelOpdbIds
      .map((m) => m.opdb_id)
      .filter((id): id is string => id != null),
  );
  const actualNewModels = modelsToCreate.filter(
    (m) =>
      m.opdb_id !== null &&
      m.opdb_id !== undefined &&
      !existingOpdbIdSet.has(m.opdb_id),
  );

  await db
    .insert(models)
    .values(actualNewModels)
    .onConflictDoNothing({ target: models.opdb_id });

  SeedLogger.success(
    `Created ${String(actualNewModels.length)} new models (${String(modelsToCreate.length - actualNewModels.length)} already existed)`,
  );
}

// ============================================================================
// Machine Management
// ============================================================================

/**
 * Create machines for organization
 */
async function createMachines(
  organization_id: string,
  games: UniqueGame[],
): Promise<void> {
  if (games.length === 0) {
    return;
  }

  // Find a location for this organization (no is_default field in schema)
  const location = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(eq(locations.organization_id, organization_id))
    .limit(1);

  if (location.length === 0) {
    throw new Error(
      `Default location not found for organization ${organization_id}`,
    );
  }

  if (!location[0]) {
    throw new Error(
      `Location query returned empty result for organization ${organization_id}`,
    );
  }
  const location_id = location[0].id;

  // Get admin user for machine ownership
  const devUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, SEED_TEST_IDS.EMAILS.ADMIN))
    .limit(1);

  const owner_id = devUsers[0]?.id;

  // Get all models by OPDB ID
  const modelsData = await db
    .select({ id: models.id, opdb_id: models.opdb_id, name: models.name })
    .from(models);

  const modelsMap = new Map(modelsData.map((m) => [m.opdb_id, m]));

  // Get existing machines for this organization and location
  const existingMachines = await db
    .select({ model_id: machines.model_id })
    .from(machines)
    .where(
      and(
        eq(machines.organization_id, organization_id),
        eq(machines.location_id, location_id),
      ),
    );

  const existingMachineModelIds = new Set(
    existingMachines.map((m) => m.model_id),
  );

  // Build machines to create
  const machinesToCreate: (typeof machines.$inferInsert)[] = [];
  let machineCount = 0;

  for (const game of games) {
    const model = modelsMap.get(game.opdbId) as
      | { id: string; name: string; opdb_id: string }
      | undefined;
    if (!model || existingMachineModelIds.has(model.id)) {
      continue;
    }

    machineCount++;
    machinesToCreate.push({
      id: `machine-${organization_id}-${machineCount.toString().padStart(3, "0")}`,
      model_id: model.id,
      organization_id,
      location_id,
      owner_id,
      name: `${model.name} #${String(machineCount)}`, // Add instance-specific name
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  if (machinesToCreate.length > 0) {
    await db.insert(machines).values(machinesToCreate).onConflictDoNothing();
    SeedLogger.success(`Created ${String(machinesToCreate.length)} machines`);
  }
}

/**
 * Create competitor organization machine for cross-org testing
 */
async function createCompetitorMachine(): Promise<void> {
  // Find "Revenge from Mars" model for shared testing
  const revengeModel = await db
    .select({ id: models.id })
    .from(models)
    .where(eq(models.opdb_id, "G50Wr-MLeZP"))
    .limit(1);

  if (revengeModel.length === 0) {
    throw new Error("Revenge from Mars model not found for competitor machine");
  }

  if (!revengeModel[0]) {
    throw new Error("Revenge from Mars model query returned empty result");
  }
  const model_id = revengeModel[0].id;

  // Find competitor organization location (no is_default field in schema)
  const competitorLocation = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      eq(locations.organization_id, SEED_TEST_IDS.ORGANIZATIONS.competitor),
    )
    .limit(1);

  if (competitorLocation.length === 0) {
    throw new Error("Competitor organization location not found");
  }

  if (!competitorLocation[0]) {
    throw new Error("Competitor location query returned empty result");
  }
  const location_id = competitorLocation[0].id;

  // Create competitor machine
  await db
    .insert(machines)
    .values({
      id: "machine-competitor-001",
      name: "Revenge from Mars - Competitor",
      model_id,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      location_id,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .onConflictDoNothing();
}

// ============================================================================
// Issue Management
// ============================================================================

/**
 * Create sample issues mapped to machines
 */
async function createSampleIssues(
  organization_id: string,
  dataAmount: DataAmount,
): Promise<void> {
  const issueData = dataAmount === "minimal" ? minimalIssues : fullIssues;

  if (issueData.length === 0) {
    return;
  }

  // Get machine mappings for this organization
  const organizationMachines = await db
    .select({
      id: machines.id,
      model_id: machines.model_id,
      opdb_id: models.opdb_id,
    })
    .from(machines)
    .innerJoin(models, eq(machines.model_id, models.id))
    .where(eq(machines.organization_id, organization_id));

  if (organizationMachines.length === 0) {
    throw new Error(`No machines found for organization ${organization_id}`);
  }

  // Create a mapping from machine test IDs to actual machine IDs
  const machine_idMap = new Map<string, string>();

  // Map known SEED_TEST_IDS.MACHINES to actual machine IDs
  for (const machine of organizationMachines) {
    // Simple mapping based on OPDB ID patterns
    if (machine.opdb_id === "GBLLd-MdEON-A94po") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.ULTRAMAN_KAIJU, machine.id);
    } else if (machine.opdb_id === "G42Pk-MZe2e") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.XENON_1, machine.id);
    } else if (machine.opdb_id === "GrknN-MQrdv") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.CLEOPATRA_1, machine.id);
    } else if (machine.opdb_id === "G50Wr-MLeZP") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1, machine.id);
    }
    // Add more mappings as needed
  }

  // Filter and map issues to actual machine IDs
  const issuesToCreate: (typeof issues.$inferInsert)[] = issueData
    .filter((issue) => machine_idMap.has(issue.machine_id))
    .map((issue) => ({
      ...issue,
      machine_id:
        machine_idMap.get(issue.machine_id) ??
        (() => {
          throw new Error(`Machine ID not found in map: ${issue.machine_id}`);
        })(),
      organization_id,
    }));

  if (issuesToCreate.length > 0) {
    await db.insert(issues).values(issuesToCreate).onConflictDoNothing();
    SeedLogger.success(
      `Created ${String(issuesToCreate.length)} sample issues`,
    );
  }
}

// ============================================================================
// Main Export Function
// ============================================================================

/**
 * Main sample data seeding function with unified patterns
 */
export async function seedSampleData(
  organization_id: string,
  dataAmount: DataAmount,
): Promise<SeedResult<SampleDataResult>> {
  const startTime = Date.now();

  try {
    // Extract unique games from sample data
    const uniqueGames = await withErrorContext(
      "SAMPLE_DATA",
      "extract unique games from sample issues",
      async () => extractUniqueGames(dataAmount),
    );

    // Create OPDB models
    await withErrorContext("SAMPLE_DATA", "create OPDB models", () =>
      createModels(uniqueGames),
    );

    // Create machines for organization
    await withErrorContext(
      "SAMPLE_DATA",
      "create machines for organization",
      () => createMachines(organization_id, uniqueGames),
    );

    // Create competitor machine for cross-org testing
    await withErrorContext("SAMPLE_DATA", "create competitor machine", () =>
      createCompetitorMachine(),
    );

    // Create sample issues
    const issueCount = await withErrorContext(
      "SAMPLE_DATA",
      "create sample issues",
      async () => {
        await createSampleIssues(organization_id, dataAmount);
        const issueData = dataAmount === "minimal" ? minimalIssues : fullIssues;
        return issueData.length;
      },
    );

    const result: SampleDataResult = {
      gamesCreated: uniqueGames.length,
      machinesCreated: uniqueGames.length + 1, // +1 for competitor machine
      issuesCreated: issueCount,
    };

    SeedLogger.success(
      `Sample data seeded: ${result.gamesCreated} games, ${result.machinesCreated} machines, ${result.issuesCreated} issues`,
    );

    return createSeedResult(
      result,
      result.gamesCreated + result.machinesCreated + result.issuesCreated,
      startTime,
    );
  } catch (error) {
    SeedLogger.error("SAMPLE_DATA", error);
    return createFailedSeedResult(error, startTime);
  }
}

/**
 * Legacy function for database instance injection (PGlite testing)
 * @deprecated Use seedSampleData instead
 */
export async function seedSampleDataWithDb(
  organization_id: string,
  dataAmount: DataAmount,
): Promise<void> {
  // For now, just call the main function since we're not using dbInstance injection pattern anymore
  const result = await seedSampleData(organization_id, dataAmount);
  if (!result.success) {
    throw new Error(
      `Sample data seeding failed: ${result.errors?.join(", ") ?? "Unknown error"}`,
    );
  }
}
