/**
 * Modern Sample Data Seeding - Drizzle + Supabase Native
 *
 * Creates machines and sample issues using pure Drizzle queries.
 * Uses existing sample-issues.json for rich, realistic test data.
 *
 * Architecture:
 * - Drizzle ORM for all database operations
 * - Supabase native patterns
 * - TypeScript strictest compliance
 * - Modern error handling with detailed logging
 */

import { eq, and, inArray, sql } from "drizzle-orm";
import minimalIssues from "./minimal-issues";
import fullIssues from "./full-issues";

// Quiet mode for tests
const isTestMode = process.env.NODE_ENV === "test" || process.env.VITEST;
const log = (...args: unknown[]) => {
  if (!isTestMode) console.log(...args);
};

import { createDrizzleClient } from "~/server/db/drizzle";
import { models, machines, issues, users, locations } from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

const db = createDrizzleClient();

type DataAmount = "minimal" | "full";

// Auth user synchronization no longer needed - users are created atomically

interface UniqueGame {
  opdbId: string;
  name: string;
  manufacturer?: string | undefined;
  year?: number | undefined;
}

/**
 * Extract unique games from TypeScript issue data
 */
async function extractUniqueGames(
  dataAmount: DataAmount,
): Promise<UniqueGame[]> {
  try {
    // Use TypeScript static data instead of JSON
    const issueData = dataAmount === "minimal" ? minimalIssues : fullIssues;

    if (issueData.length === 0) {
      log("[SAMPLE] No sample issues data available");
      return [];
    }

    log(`[SAMPLE] Processing ${issueData.length.toString()} sample issues...`);

    // Since we're using pre-defined SEED_TEST_IDS.MACHINES, we can extract the known games
    const gameMap = new Map<string, UniqueGame>();

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

    // Add known games to map
    knownGames.forEach((game) => gameMap.set(game.opdbId, game));

    const uniqueGames = Array.from(gameMap.values());
    log(`[SAMPLE] Found ${uniqueGames.length.toString()} unique games`);

    // For minimal mode, we already have the right set since we selected the right data source
    if (dataAmount === "minimal") {
      log(
        `[SAMPLE] Limited to ${uniqueGames.length.toString()} games for minimal seeding (all games referenced in minimal issues)`,
      );
    }

    return uniqueGames;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[SAMPLE] ❌ Failed to extract unique games: ${errorMessage}`,
    );
    throw new Error(
      `Failed to extract games from sample issues: ${errorMessage}`,
    );
  }
}

/**
 * Parse basic manufacturer/year from game titles
 * This is basic heuristic parsing - not comprehensive
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

  // Year extraction is complex and unreliable from titles alone
  // We'll leave year as undefined for now

  return { manufacturer, year: undefined };
}

/**
 * Create OPDB models with provided database instance
 */
async function createModelsWithDb(
  dbInstance: typeof db,
  games: UniqueGame[],
): Promise<void> {
  log(`[SAMPLE] Creating ${games.length.toString()} OPDB models...`);

  try {
    if (games.length === 0) {
      log(`[SAMPLE] No games to process`);
      return;
    }

    // Build all models to create
    const modelsToCreate = games.map((game) => ({
      id: `model_${game.opdbId}`, // Deterministic ID generation
      name: game.name,
      manufacturer: game.manufacturer,
      year: game.year,
      opdbId: game.opdbId,
      // isCustom defaults to false in schema (OPDB games)
      // organizationId defaults to null in schema (global access)
      isActive: true,
    }));

    // Use PostgreSQL upsert pattern - insert all, ignore conflicts on opdbId
    if (modelsToCreate.length > 0) {
      // Check existing models to provide better logging
      const existingModelOpdbIds = await dbInstance
        .select({ opdbId: models.opdbId })
        .from(models)
        .where(
          inArray(
            models.opdbId,
            modelsToCreate.map((m) => m.opdbId),
          ),
        );
      const existingOpdbIdSet = new Set(
        existingModelOpdbIds.map((m) => m.opdbId),
      );
      const actualNewModels = modelsToCreate.filter(
        (m) => !existingOpdbIdSet.has(m.opdbId),
      );

      await dbInstance
        .insert(models)
        .values(modelsToCreate)
        .onConflictDoNothing({ target: models.opdbId });

      log(
        `[SAMPLE] ✅ Inserted ${actualNewModels.length} new models (out of ${modelsToCreate.length}) via optimized upsert (${modelsToCreate.length - actualNewModels.length} conflicts ignored)`,
      );
    }

    log(`[SAMPLE] ✅ Model creation completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Model creation failed: ${errorMessage}`);
    throw new Error(`Failed to create models: ${errorMessage}`);
  }
}

/**
 * Create machines with provided database instance
 */
async function createMachinesWithDb(
  dbInstance: typeof db,
  organizationId: string,
  games: UniqueGame[],
  dataAmount: DataAmount,
): Promise<void> {
  log(`[SAMPLE] Creating machines for ${games.length.toString()} models...`);

  try {
    if (games.length === 0) {
      log(`[SAMPLE] No games to process for machine creation`);
      return;
    }

    // Find the Austin Pinball Collective location
    const location = await dbInstance
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(
        and(
          eq(locations.organizationId, organizationId),
          eq(locations.name, "Austin Pinball Collective"),
        ),
      )
      .limit(1);

    if (location.length === 0) {
      throw new Error("Austin Pinball Collective location not found");
    }

    const locationRecord = location[0];
    if (!locationRecord) {
      throw new Error("Location record is unexpectedly undefined");
    }
    const locationId = locationRecord.id;
    log(`[SAMPLE] Using location: ${locationRecord.name}`);

    // Get dev users for machine ownership rotation
    const devUsers = await dbInstance
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        eq(users.email, SEED_TEST_IDS.EMAILS.ADMIN), // Use seeded admin user for machine ownership
      )
      .limit(1);

    const devUser = devUsers[0];
    const ownerId = devUser?.id;

    // Get all models by OPDB ID in one query
    const modelsData = await dbInstance
      .select({ id: models.id, opdbId: models.opdbId, name: models.name })
      .from(models);

    const modelsMap = new Map(modelsData.map((m) => [m.opdbId, m]));

    log(
      `[SAMPLE] Found ${modelsData.length} models in database, processing ${games.length} games`,
    );

    // Get existing machines for this organization and location
    const existingMachines = await dbInstance
      .select({ modelId: machines.modelId })
      .from(machines)
      .where(
        and(
          eq(machines.organizationId, organizationId),
          eq(machines.locationId, locationId),
        ),
      );

    const existingMachineModelIds = new Set(
      existingMachines.map((m) => m.modelId),
    );

    // Build machines to create
    const machinesToCreate: (typeof machines.$inferInsert)[] = [];
    let machineCount = 0;

    for (const game of games) {
      const model = modelsMap.get(game.opdbId);
      if (!model) {
        log(
          `[SAMPLE] ⚠️  Model not found for ${game.name} (opdbId: ${game.opdbId}), skipping machine`,
        );
        continue;
      }

      // Check if machine already exists for this model
      if (!existingMachineModelIds.has(model.id)) {
        machineCount++;
        const qrCodeId = `qr-${game.name.toLowerCase().replace(/\s+/g, "-")}-${machineCount}`;

        machinesToCreate.push({
          id: `machine_${model.id}_${locationId}`, // Deterministic ID
          name: `${game.name} #${machineCount}`,
          organizationId,
          locationId,
          modelId: model.id,
          ownerId,
          qrCodeId,
          ownerNotificationsEnabled: true,
          notifyOnNewIssues: true,
          notifyOnStatusChanges: true,
          notifyOnComments: false,
        });
      }
    }

    // Batch upsert all machines
    if (machinesToCreate.length > 0) {
      try {
        await dbInstance
          .insert(machines)
          .values(machinesToCreate)
          .onConflictDoUpdate({
            target: machines.id,
            set: {
              name: sql.raw(`excluded."name"`),
              ownerId: sql.raw(`excluded."ownerId"`),
              qrCodeId: sql.raw(`excluded."qrCodeId"`),
              ownerNotificationsEnabled: sql.raw(
                `excluded."ownerNotificationsEnabled"`,
              ),
              notifyOnNewIssues: sql.raw(`excluded."notifyOnNewIssues"`),
              notifyOnStatusChanges: sql.raw(
                `excluded."notifyOnStatusChanges"`,
              ),
              notifyOnComments: sql.raw(`excluded."notifyOnComments"`),
              updatedAt: new Date(),
            },
          });
        log(
          `[SAMPLE] ✅ Upserted ${machinesToCreate.length.toString()} machines via batch upsert`,
        );

        // Add verification log for minimal mode
        if (dataAmount === "minimal") {
          log(
            `[SAMPLE] 📊 Verification: Upserted ${machinesToCreate.length} machines for minimal mode (expected: 6)`,
          );
        }
      } catch (error) {
        console.error(`[SAMPLE] ❌ Failed to batch upsert machines:`, error);
        throw new Error(
          `Machine creation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      log(
        `[SAMPLE] ⏭️  All machines for ${games.length.toString()} models already exist`,
      );
    }

    log(
      `[SAMPLE] ✅ Machine creation completed (${machinesToCreate.length} new machines)`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Machine creation failed: ${errorMessage}`);
    throw new Error(`Failed to create machines: ${errorMessage}`);
  }
}

/**
 * Create a competitor organization machine using the same model as primary organization
 * Tests cross-org isolation with shared global OPDB models
 */
async function createCompetitorMachine(dbInstance: typeof db): Promise<void> {
  log(`[SAMPLE] Creating competitor organization machine...`);

  try {
    const competitorOrgId = SEED_TEST_IDS.ORGANIZATIONS.competitor;
    const revengeFromMarsOpdbId = "G50Wr-MLeZP"; // From sample-issues.json

    // Get the competitor organization's default location
    const competitorLocation = await dbInstance
      .select({ id: locations.id })
      .from(locations)
      .where(eq(locations.organizationId, competitorOrgId))
      .limit(1);

    if (competitorLocation.length === 0) {
      console.warn(
        `[SAMPLE] ⚠️  No default location found for competitor organization, skipping competitor machine`,
      );
      return;
    }

    const locationId = competitorLocation[0]?.id;
    if (!locationId) {
      console.warn(
        `[SAMPLE] ⚠️  No location ID found for competitor organization, skipping competitor machine`,
      );
      return;
    }

    // Get the "Revenge from Mars" model by OPDB ID
    const revengeModel = await dbInstance
      .select({ id: models.id, name: models.name })
      .from(models)
      .where(eq(models.opdbId, revengeFromMarsOpdbId))
      .limit(1);

    if (revengeModel.length === 0) {
      console.warn(
        `[SAMPLE] ⚠️  "Revenge from Mars" model not found, skipping competitor machine`,
      );
      return;
    }

    const model = revengeModel[0];
    if (!model) {
      console.warn(
        `[SAMPLE] ⚠️  Model data not found, skipping competitor machine`,
      );
      return;
    }

    // Check if competitor machine already exists
    const existingMachine = await dbInstance
      .select({ id: machines.id })
      .from(machines)
      .where(
        and(
          eq(machines.organizationId, competitorOrgId),
          eq(machines.modelId, model.id),
        ),
      )
      .limit(1);

    if (existingMachine.length > 0) {
      log(`[SAMPLE] ⏭️  Competitor "Revenge from Mars" machine already exists`);
      return;
    }

    // Create the competitor machine
    const competitorMachine = {
      id: `machine_competitor_${model.id}`, // Unique deterministic ID
      name: `${model.name} - Competitor #1`,
      organizationId: competitorOrgId,
      locationId,
      modelId: model.id,
      ownerId: null, // No owner for competitor machine
      qrCodeId: `qr-competitor-revenge-from-mars`,
      ownerNotificationsEnabled: false,
      notifyOnNewIssues: false,
      notifyOnStatusChanges: false,
      notifyOnComments: false,
    };

    await dbInstance
      .insert(machines)
      .values(competitorMachine)
      .onConflictDoUpdate({
        target: machines.id,
        set: {
          name: sql.raw(`excluded."name"`),
          ownerId: sql.raw(`excluded."ownerId"`),
          qrCodeId: sql.raw(`excluded."qrCodeId"`),
          ownerNotificationsEnabled: sql.raw(
            `excluded."ownerNotificationsEnabled"`,
          ),
          notifyOnNewIssues: sql.raw(`excluded."notifyOnNewIssues"`),
          notifyOnStatusChanges: sql.raw(`excluded."notifyOnStatusChanges"`),
          notifyOnComments: sql.raw(`excluded."notifyOnComments"`),
          updatedAt: new Date(),
        },
      });

    log(`[SAMPLE] ✅ Upserted competitor machine: ${competitorMachine.name}`);
    log(
      `[SAMPLE] 🎯 Testing scenario: Both organizations have "${model.name}" machines for cross-org isolation testing`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[SAMPLE] ❌ Competitor machine creation failed: ${errorMessage}`,
    );
    throw new Error(`Failed to create competitor machine: ${errorMessage}`);
  }
}

/**
 * Create sample issues with provided database instance
 */
async function createSampleIssuesWithDb(
  dbInstance: typeof db,
  organizationId: string,
  dataAmount: DataAmount,
  skipAuthUsers = false,
): Promise<void> {
  try {
    // Use static TypeScript data instead of JSON
    const issuesData = dataAmount === "minimal" ? minimalIssues : fullIssues;

    if (issuesData.length === 0) {
      log("[SAMPLE] No sample issues data available");
      return;
    }

    log(`[SAMPLE] Found ${issuesData.length.toString()} sample issues...`);

    // Filter issues for the target organization
    const targetIssues = issuesData.filter(
      (issue) => issue.organizationId === organizationId,
    );

    if (targetIssues.length === 0) {
      log(
        `[SAMPLE] No issues found for organization ${organizationId}, skipping`,
      );
      return;
    }

    log(
      `[SAMPLE] Creating ${targetIssues.length.toString()} issues for organization`,
    );

    // Check for existing issues to avoid duplicates
    const existingIssues = await dbInstance
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.organizationId, organizationId));

    const existingIssueIds = new Set(existingIssues.map((i) => i.id));

    // Filter out issues that already exist
    const issuesToCreate = targetIssues.filter(
      (issue) => !existingIssueIds.has(issue.id),
    );

    if (issuesToCreate.length === 0) {
      log(`[SAMPLE] ⏭️  All issues already exist, skipping creation`);
      return;
    }

    log(`[SAMPLE] Preparing to upsert ${issuesToCreate.length} issues`);

    // Batch upsert all issues using static SEED_TEST_IDS data
    try {
      await dbInstance
        .insert(issues)
        .values(issuesToCreate)
        .onConflictDoUpdate({
          target: issues.id,
          set: {
            title: sql.raw(`excluded."title"`),
            description: sql.raw(`excluded."description"`),
            priorityId: sql.raw(`excluded."priorityId"`),
            statusId: sql.raw(`excluded."statusId"`),
            updatedAt: new Date(),
          },
        });
      log(
        `[SAMPLE] ✅ Upserted ${issuesToCreate.length.toString()} issues via batch upsert`,
      );
    } catch (error) {
      console.error(`[SAMPLE] ❌ Failed to batch upsert issues:`, error);
      throw new Error(
        `Issue creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    log(
      `[SAMPLE] ✅ Issue creation completed: ${issuesToCreate.length} created, ${targetIssues.length - issuesToCreate.length} already existed`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Issue creation failed: ${errorMessage}`);
    throw new Error(`Failed to create sample issues: ${errorMessage}`);
  }
}

/**
 * Main sample data seeding function
 */
export async function seedSampleData(
  organizationId: string,
  dataAmount: DataAmount,
  skipAuthUsers = false,
): Promise<void> {
  return await seedSampleDataWithDb(
    db,
    organizationId,
    dataAmount,
    skipAuthUsers,
  );
}

/**
 * Sample data seeding function that accepts a database instance
 * This enables usage with PGlite for testing while maintaining production functionality
 */
export async function seedSampleDataWithDb(
  dbInstance: typeof db,
  organizationId: string,
  dataAmount: DataAmount,
  skipAuthUsers = false,
): Promise<void> {
  const startTime = Date.now();
  log(
    `[SAMPLE] 🎮 Starting sample data seeding for organization ${organizationId}...`,
  );
  log(
    `[SAMPLE] Data amount: ${dataAmount.toUpperCase()} (${dataAmount === "minimal" ? "limited for CI/dev" : "full dataset for preview"})`,
  );

  try {
    // Phase 1: Extract unique games from sample issues
    const uniqueGames = await extractUniqueGames(dataAmount);

    // Phase 2: Create OPDB models
    await createModelsWithDb(dbInstance, uniqueGames);

    // Phase 3: Create machines for all models
    await createMachinesWithDb(
      dbInstance,
      organizationId,
      uniqueGames,
      dataAmount,
    );

    // Phase 3.5: Create competitor organization machine for cross-org testing
    await createCompetitorMachine(dbInstance);

    // Phase 4: Create sample issues mapped to machines
    await createSampleIssuesWithDb(
      dbInstance,
      organizationId,
      dataAmount,
      skipAuthUsers,
    );

    const duration = Date.now() - startTime;
    log(
      `[SAMPLE] ✅ Sample data seeding completed successfully in ${duration}ms!`,
    );
    log(`[SAMPLE] 📊 Summary:`);
    log(
      `[SAMPLE]   - Games: ${uniqueGames.length} unique OPDB models (${dataAmount === "minimal" ? "6 for minimal" : "full catalog"})`,
    );
    log(
      `[SAMPLE]   - Machines: ${uniqueGames.length} primary org machines + 1 competitor machine (${dataAmount === "minimal" ? "6 + 1 = 7 total" : "full dataset"})`,
    );
    log(
      `[SAMPLE]   - Cross-org testing: Shared "Revenge from Mars" model with isolated machines`,
    );
    log(
      `[SAMPLE]   - Issues: ${dataAmount === "minimal" ? "10 minimal issues" : "Full dataset"} from curated data`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Sample data seeding failed: ${errorMessage}`);
    throw error;
  }
}
