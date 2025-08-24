/**
 * Sample Data Seeding - Unified with Shared Utilities
 *
 * Creates machines and sample issues using pure Drizzle queries.
 * Uses standardized error handling, logging, and patterns.
 */

// Node modules
import { eq, and, inArray, sql } from "drizzle-orm";

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
async function extractUniqueGames(
  dataAmount: DataAmount,
): Promise<UniqueGame[]> {
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

/**
 * Parse basic manufacturer/year from game titles
 */
function parseGameTitle(title: string): {
  manufacturer?: string | undefined;
  year?: number | undefined;
} {
  // Common manufacturer patterns
  const sternGames = [
    "AC/DC",
    "Ultraman",
    "Lord of the Rings",
    "Star Trek",
    "Game of Thrones",
  ];
  const ballyGames = ["Xenon", "Eight Ball Deluxe", "Black Knight"];
  const gottliebGames = ["Cleopatra"];
  const williamsGames = [
    "Medieval Madness",
    "Revenge from Mars",
    "World Cup Soccer",
  ];

  let manufacturer: string | undefined;

  if (sternGames.some((game) => title.includes(game))) {
    manufacturer = "Stern";
  } else if (ballyGames.some((game) => title.includes(game))) {
    manufacturer = "Bally";
  } else if (gottliebGames.some((game) => title.includes(game))) {
    manufacturer = "Gottlieb";
  } else if (williamsGames.some((game) => title.includes(game))) {
    manufacturer = "Williams";
  }

  return { manufacturer, year: undefined };
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

  const modelsToCreate = games.map((game) => ({
    id: `model_${game.opdbId}`,
    name: game.name,
    manufacturer: game.manufacturer,
    year: game.year,
    opdbId: game.opdbId,
    is_active: true,
  }));

  // Check existing models
  const existingModelOpdbIds = await db
    .select({ opdbId: models.opdbId })
    .from(models)
    .where(
      inArray(
        models.opdbId,
        modelsToCreate.map((m) => m.opdbId),
      ),
    );

  const existingOpdbIdSet = new Set(existingModelOpdbIds.map((m) => m.opdbId));
  const actualNewModels = modelsToCreate.filter(
    (m) => !existingOpdbIdSet.has(m.opdbId),
  );

  await db
    .insert(models)
    .values(modelsToCreate)
    .onConflictDoNothing({ target: models.opdbId });

  SeedLogger.success(
    `Created ${actualNewModels.length} new models (${modelsToCreate.length - actualNewModels.length} already existed)`,
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
  dataAmount: DataAmount,
): Promise<void> {
  if (games.length === 0) {
    return;
  }

  // Find the default location for this organization
  const location = await db
    .select({ id: locations.id, name: locations.name })
    .from(locations)
    .where(
      and(
        eq(locations.organization_id, organization_id),
        eq(locations.is_default, true),
      ),
    )
    .limit(1);

  if (location.length === 0) {
    throw new Error(
      `Default location not found for organization ${organization_id}`,
    );
  }

  const location_id = location[0]!.id;

  // Get admin user for machine ownership
  const devUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, SEED_TEST_IDS.EMAILS.ADMIN))
    .limit(1);

  const owner_id = devUsers[0]?.id;

  // Get all models by OPDB ID
  const modelsData = await db
    .select({ id: models.id, opdbId: models.opdbId, name: models.name })
    .from(models);

  const modelsMap = new Map(modelsData.map((m) => [m.opdbId, m]));

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
    const model = modelsMap.get(game.opdbId);
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
      status: "active",
      condition: machineCount <= 3 ? "excellent" : "good",
      is_public: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  if (machinesToCreate.length > 0) {
    await db.insert(machines).values(machinesToCreate).onConflictDoNothing();
    SeedLogger.success(`Created ${machinesToCreate.length} machines`);
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
    .where(eq(models.opdbId, "G50Wr-MLeZP"))
    .limit(1);

  if (revengeModel.length === 0) {
    throw new Error("Revenge from Mars model not found for competitor machine");
  }

  const model_id = revengeModel[0]!.id;

  // Find competitor organization default location
  const competitorLocation = await db
    .select({ id: locations.id })
    .from(locations)
    .where(
      and(
        eq(locations.organization_id, SEED_TEST_IDS.ORGANIZATIONS.competitor),
        eq(locations.is_default, true),
      ),
    )
    .limit(1);

  if (competitorLocation.length === 0) {
    throw new Error("Competitor organization default location not found");
  }

  const location_id = competitorLocation[0]!.id;

  // Create competitor machine
  await db
    .insert(machines)
    .values({
      id: "machine-competitor-001",
      model_id,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor,
      location_id,
      status: "active",
      condition: "good",
      is_public: false,
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
  skipAuthUsers = false,
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
      opdbId: models.opdbId,
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
    if (machine.opdbId === "GBLLd-MdEON-A94po") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.ULTRAMAN_KAIJU, machine.id);
    } else if (machine.opdbId === "G42Pk-MZe2e") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.XENON_1, machine.id);
    } else if (machine.opdbId === "GrknN-MQrdv") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.CLEOPATRA_1, machine.id);
    } else if (machine.opdbId === "G50Wr-MLeZP") {
      machine_idMap.set(SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1, machine.id);
    }
    // Add more mappings as needed
  }

  // Filter and map issues to actual machine IDs
  const issuesToCreate = issueData
    .filter((issue) => machine_idMap.has(issue.machine_id))
    .map((issue) => ({
      ...issue,
      machine_id: machine_idMap.get(issue.machine_id)!,
      organization_id,
    }));

  if (issuesToCreate.length > 0) {
    await db.insert(issues).values(issuesToCreate).onConflictDoNothing();
    SeedLogger.success(`Created ${issuesToCreate.length} sample issues`);
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
  skipAuthUsers = false,
): Promise<SeedResult<SampleDataResult>> {
  const startTime = Date.now();

  try {
    // Extract unique games from sample data
    const uniqueGames = await withErrorContext(
      "SAMPLE_DATA",
      "extract unique games from sample issues",
      () => extractUniqueGames(dataAmount),
    );

    // Create OPDB models
    await withErrorContext("SAMPLE_DATA", "create OPDB models", () =>
      createModels(uniqueGames),
    );

    // Create machines for organization
    await withErrorContext(
      "SAMPLE_DATA",
      "create machines for organization",
      () => createMachines(organization_id, uniqueGames, dataAmount),
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
        await createSampleIssues(organization_id, dataAmount, skipAuthUsers);
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
  dbInstance: typeof db,
  organization_id: string,
  dataAmount: DataAmount,
  skipAuthUsers = false,
): Promise<void> {
  // For now, just call the main function since we're not using dbInstance injection pattern anymore
  const result = await seedSampleData(
    organization_id,
    dataAmount,
    skipAuthUsers,
  );
  if (!result.success) {
    throw new Error(
      `Sample data seeding failed: ${result.errors?.join(", ") ?? "Unknown error"}`,
    );
  }
}
