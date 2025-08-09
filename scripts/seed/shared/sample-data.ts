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

import { eq, and, inArray } from "drizzle-orm";

import { createDrizzleClient } from "~/server/db/drizzle";
import {
  models,
  machines,
  issues,
  priorities,
  issueStatuses,
  users,
  locations,
} from "~/server/db/schema";

const db = createDrizzleClient();

type DataAmount = "minimal" | "full";

/**
 * Wait for auth users to synchronize from Supabase Auth to database
 * This prevents the race condition where sample issues are created before
 * auth users appear in the users table via database triggers
 */
async function waitForAuthUserSync(requiredEmails: string[]): Promise<void> {
  const MAX_ATTEMPTS = 10;
  const INITIAL_DELAY_MS = 1000; // Start with 1 second
  const MAX_DELAY_MS = 8000; // Cap at 8 seconds

  console.log(
    `[SAMPLE] 🔄 Waiting for ${requiredEmails.length} auth users to sync to database...`,
  );
  console.log(`[SAMPLE] Required users: ${requiredEmails.join(", ")}`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Query for users in database
    const foundUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.email, requiredEmails));

    const foundEmails = foundUsers
      .map((u) => u.email)
      .filter(Boolean) as string[];
    const missingEmails = requiredEmails.filter(
      (email) => !foundEmails.includes(email),
    );

    console.log(
      `[SAMPLE] 🔍 Attempt ${attempt}/${MAX_ATTEMPTS}: Found ${foundEmails.length}/${requiredEmails.length} users`,
    );

    if (missingEmails.length === 0) {
      console.log(
        `[SAMPLE] ✅ All required users found in database after ${attempt} attempts`,
      );
      return;
    }

    if (attempt === MAX_ATTEMPTS) {
      const errorMsg = `Auth user synchronization failed after ${MAX_ATTEMPTS} attempts. Missing users: ${missingEmails.join(", ")}. This indicates that Supabase auth triggers are not working or auth users were not created properly.`;
      console.error(`[SAMPLE] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(
      INITIAL_DELAY_MS * Math.pow(1.5, attempt - 1),
      MAX_DELAY_MS,
    );
    const jitter = Math.random() * 0.3; // ±30% jitter
    const delay = Math.floor(baseDelay * (1 + jitter));

    console.log(
      `[SAMPLE] ⏳ Missing users: ${missingEmails.join(", ")} - waiting ${delay}ms before retry`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

interface SampleIssue {
  title: string;
  description: string;
  severity: string; // Will map to priority
  consistency: string;
  status: string;
  gameTitle: string;
  reporterEmail: string;
  createdAt: string;
  updatedAt: string;
  gameOpdbId: string;
}

interface UniqueGame {
  opdbId: string;
  name: string;
  manufacturer?: string | undefined;
  year?: number | undefined;
}

/**
 * Extract unique games from sample issues JSON
 */
async function extractUniqueGames(
  dataAmount: DataAmount,
): Promise<UniqueGame[]> {
  try {
    // Import sample issues JSON
    const sampleIssuesModule = await import(
      "../../../prisma/seeds/sample-issues.json"
    );
    const sampleIssues: SampleIssue[] = sampleIssuesModule.default;

    console.log(
      `[SAMPLE] Processing ${sampleIssues.length.toString()} sample issues...`,
    );

    // Create map to deduplicate by OPDB ID
    const gameMap = new Map<string, UniqueGame>();

    for (const issue of sampleIssues) {
      if (!gameMap.has(issue.gameOpdbId)) {
        // Extract manufacturer and year from game title if possible
        const { manufacturer, year } = parseGameTitle(issue.gameTitle);

        gameMap.set(issue.gameOpdbId, {
          opdbId: issue.gameOpdbId,
          name: issue.gameTitle,
          manufacturer,
          year,
        });
      }
    }

    let uniqueGames = Array.from(gameMap.values());
    console.log(`[SAMPLE] Found ${uniqueGames.length.toString()} unique games`);

    // Limit data for minimal mode (for CI tests and local development)
    if (dataAmount === "minimal") {
      const MINIMAL_GAME_LIMIT = 4;
      uniqueGames = uniqueGames.slice(0, MINIMAL_GAME_LIMIT);
      console.log(
        `[SAMPLE] Limited to ${uniqueGames.length.toString()} games for minimal seeding`,
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
 * Create OPDB models from unique games with optimized upsert operations
 */
async function createModels(games: UniqueGame[]): Promise<void> {
  console.log(`[SAMPLE] Creating ${games.length.toString()} OPDB models...`);

  try {
    if (games.length === 0) {
      console.log(`[SAMPLE] No games to process`);
      return;
    }

    // Build all models to create
    const modelsToCreate = games.map((game) => ({
      id: `model_${game.opdbId}`, // Deterministic ID generation
      name: game.name,
      manufacturer: game.manufacturer,
      year: game.year,
      opdbId: game.opdbId,
      isCustom: false, // OPDB games are not custom
      isActive: true,
    }));

    // Use PostgreSQL upsert pattern - insert all, ignore conflicts on opdbId
    if (modelsToCreate.length > 0) {
      // Check existing models to provide better logging
      const existingModelOpdbIds = await db
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

      await db
        .insert(models)
        .values(modelsToCreate)
        .onConflictDoNothing({ target: models.opdbId });

      console.log(
        `[SAMPLE] ✅ Inserted ${actualNewModels.length} new models (out of ${modelsToCreate.length}) via optimized upsert (${modelsToCreate.length - actualNewModels.length} conflicts ignored)`,
      );
    }

    console.log(`[SAMPLE] ✅ Model creation completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Model creation failed: ${errorMessage}`);
    throw new Error(`Failed to create models: ${errorMessage}`);
  }
}

/**
 * Create machines for all models at the organization's location with batch operations
 */
async function createMachines(
  organizationId: string,
  games: UniqueGame[],
): Promise<void> {
  console.log(
    `[SAMPLE] Creating machines for ${games.length.toString()} models...`,
  );

  try {
    if (games.length === 0) {
      console.log(`[SAMPLE] No games to process for machine creation`);
      return;
    }

    // Find the Austin Pinball Collective location
    const location = await db
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
    console.log(`[SAMPLE] Using location: ${locationRecord.name}`);

    // Get dev users for machine ownership rotation
    const devUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        eq(users.email, "admin@dev.local"), // Start with dev admin
      )
      .limit(1);

    const devUser = devUsers[0];
    const ownerId = devUser?.id;

    // Get all models by OPDB ID in one query
    const modelsData = await db
      .select({ id: models.id, opdbId: models.opdbId, name: models.name })
      .from(models);

    const modelsMap = new Map(modelsData.map((m) => [m.opdbId, m]));

    // Get existing machines for this organization and location
    const existingMachines = await db
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
        console.warn(
          `[SAMPLE] ⚠️  Model not found for ${game.name}, skipping machine`,
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

    // Batch create all missing machines
    if (machinesToCreate.length > 0) {
      try {
        await db.insert(machines).values(machinesToCreate);
        console.log(
          `[SAMPLE] ✅ Created ${machinesToCreate.length.toString()} machines via batch insert`,
        );
      } catch (error) {
        console.error(`[SAMPLE] ❌ Failed to batch create machines:`, error);
        throw new Error(
          `Machine creation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      console.log(
        `[SAMPLE] ⏭️  All machines for ${games.length.toString()} models already exist`,
      );
    }

    console.log(
      `[SAMPLE] ✅ Machine creation completed (${machinesToCreate.length} new machines)`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Machine creation failed: ${errorMessage}`);
    throw new Error(`Failed to create machines: ${errorMessage}`);
  }
}

/**
 * Map severity from sample issues to priority names
 */
function mapSeverityToPriority(severity: string): string {
  const severityMap: Record<string, string> = {
    Cosmetic: "Low",
    Minor: "Medium",
    Major: "High",
    Severe: "Critical",
  };

  return severityMap[severity] || "Medium"; // Default to Medium
}

/**
 * Create sample issues mapped to machines with batch operations
 */
async function createSampleIssues(
  organizationId: string,
  dataAmount: DataAmount,
): Promise<void> {
  try {
    // Import sample issues JSON
    const sampleIssuesModule = await import(
      "../../../prisma/seeds/sample-issues.json"
    );
    let sampleIssues: SampleIssue[] = sampleIssuesModule.default;

    console.log(
      `[SAMPLE] Found ${sampleIssues.length.toString()} sample issues...`,
    );

    // Limit issues for minimal mode (for CI tests and local development)
    if (dataAmount === "minimal") {
      const MINIMAL_ISSUE_LIMIT = 10;
      sampleIssues = sampleIssues.slice(0, MINIMAL_ISSUE_LIMIT);
      console.log(
        `[SAMPLE] Limited to ${sampleIssues.length.toString()} issues for minimal seeding`,
      );
    }

    console.log(
      `[SAMPLE] Creating ${sampleIssues.length.toString()} sample issues...`,
    );

    // Get priority and status mappings in batch
    const priorityMap = new Map<string, string>();
    const allPriorities = await db
      .select({ id: priorities.id, name: priorities.name })
      .from(priorities)
      .where(eq(priorities.organizationId, organizationId));

    for (const priority of allPriorities) {
      priorityMap.set(priority.name, priority.id);
    }

    const statusMap = new Map<string, string>();
    const allStatuses = await db
      .select({ id: issueStatuses.id, name: issueStatuses.name })
      .from(issueStatuses)
      .where(eq(issueStatuses.organizationId, organizationId));

    for (const status of allStatuses) {
      statusMap.set(status.name, status.id);
    }

    // Wait for auth users to sync from Supabase Auth to database
    // This prevents race condition where sample issues try to reference users
    // that don't exist yet in the database (even though they exist in auth)
    const requiredDevUsers = [
      "admin@dev.local",
      "member@dev.local",
      "player@dev.local",
    ];
    await waitForAuthUserSync(requiredDevUsers);

    // Get user mappings for creators
    const userMap = new Map<string, string>();
    const allUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users);

    console.log(`[SAMPLE] 📋 Found ${allUsers.length} total users in database`);
    const devUserEmails = allUsers
      .filter((u) => u.email?.includes("@dev.local"))
      .map((u) => u.email);
    console.log(`[SAMPLE] 🔧 Dev users available: ${devUserEmails.join(", ")}`);

    for (const user of allUsers) {
      if (user.email) {
        userMap.set(user.email, user.id);
      }
    }

    // Get machines with models in batch
    const machineData = await db
      .select({
        id: machines.id,
        name: machines.name,
        opdbId: models.opdbId,
      })
      .from(machines)
      .innerJoin(models, eq(machines.modelId, models.id))
      .where(eq(machines.organizationId, organizationId));

    const machineMap = new Map(machineData.map((m) => [m.opdbId, m]));

    // Get existing issues to avoid duplicates
    const existingIssues = await db
      .select({ title: issues.title, machineId: issues.machineId })
      .from(issues)
      .where(eq(issues.organizationId, organizationId));

    const existingIssuesSet = new Set(
      existingIssues.map((i) => `${i.machineId}_${i.title}`),
    );

    // Build issues to create
    const issuesToCreate: (typeof issues.$inferInsert)[] = [];
    let skippedCount = 0;

    for (const issueData of sampleIssues) {
      try {
        // Find machine by OPDB ID
        const machine = machineMap.get(issueData.gameOpdbId);
        if (!machine) {
          console.warn(
            `[SAMPLE] ⚠️  Machine not found for OPDB ID ${issueData.gameOpdbId}, skipping issue`,
          );
          skippedCount++;
          continue;
        }

        // Check if issue already exists
        const issueKey = `${machine.id}_${issueData.title}`;
        if (existingIssuesSet.has(issueKey)) {
          console.log(`[SAMPLE] ⏭️  Issue exists: ${issueData.title}`);
          continue;
        }

        // Map priority
        const priorityName = mapSeverityToPriority(issueData.severity);
        const priorityId = priorityMap.get(priorityName);
        if (!priorityId) {
          console.warn(
            `[SAMPLE] ⚠️  Priority '${priorityName}' not found, skipping issue`,
          );
          skippedCount++;
          continue;
        }

        // Map status
        const statusId = statusMap.get(issueData.status);
        if (!statusId) {
          console.warn(
            `[SAMPLE] ⚠️  Status '${issueData.status}' not found, skipping issue`,
          );
          skippedCount++;
          continue;
        }

        // Map creator - fail fast for dev users, skip gracefully for sample data users
        const createdById = userMap.get(issueData.reporterEmail);
        if (!createdById) {
          // Fail fast if this is a dev user that should exist
          if (issueData.reporterEmail.includes("@dev.local")) {
            const errorMsg = `Critical: Required dev user '${issueData.reporterEmail}' not found in database. This indicates auth user synchronization failed.`;
            console.error(`[SAMPLE] ❌ ${errorMsg}`);
            throw new Error(errorMsg);
          }

          // Skip gracefully for sample data users (these are from the JSON and may not exist)
          console.log(
            `[SAMPLE] ⏭️  Sample user '${issueData.reporterEmail}' not found, skipping issue "${issueData.title}"`,
          );
          skippedCount++;
          continue;
        }

        issuesToCreate.push({
          id: `issue_${issuesToCreate.length}_${Date.now()}`, // Unique ID
          title: issueData.title,
          description: issueData.description,
          consistency: issueData.consistency,
          organizationId,
          machineId: machine.id,
          statusId,
          priorityId,
          createdById,
          createdAt: new Date(issueData.createdAt),
          updatedAt: new Date(issueData.updatedAt),
        });
      } catch (error) {
        console.warn(
          `[SAMPLE] ⚠️  Failed to process issue '${issueData.title}':`,
          error,
        );
        skippedCount++;
      }
    }

    // Batch create all issues
    if (issuesToCreate.length > 0) {
      try {
        await db.insert(issues).values(issuesToCreate);
        console.log(
          `[SAMPLE] ✅ Created ${issuesToCreate.length.toString()} issues via batch insert`,
        );
      } catch (error) {
        console.error(`[SAMPLE] ❌ Failed to batch create issues:`, error);
        throw new Error(
          `Issue creation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      console.log(`[SAMPLE] ⏭️  No new issues to create`);
    }

    console.log(
      `[SAMPLE] ✅ Issue creation completed: ${issuesToCreate.length} created, ${skippedCount} skipped`,
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
): Promise<void> {
  const startTime = Date.now();
  console.log(
    `[SAMPLE] 🎮 Starting sample data seeding for organization ${organizationId}...`,
  );
  console.log(
    `[SAMPLE] Data amount: ${dataAmount.toUpperCase()} (${dataAmount === "minimal" ? "limited for CI/dev" : "full dataset for preview"})`,
  );

  try {
    // Phase 1: Extract unique games from sample issues
    const uniqueGames = await extractUniqueGames(dataAmount);

    // Phase 2: Create OPDB models
    await createModels(uniqueGames);

    // Phase 3: Create machines for all models
    await createMachines(organizationId, uniqueGames);

    // Phase 4: Create sample issues mapped to machines
    await createSampleIssues(organizationId, dataAmount);

    const duration = Date.now() - startTime;
    console.log(
      `[SAMPLE] ✅ Sample data seeding completed successfully in ${duration}ms!`,
    );
    console.log(`[SAMPLE] 📊 Summary:`);
    console.log(`[SAMPLE]   - Games: ${uniqueGames.length} unique OPDB models`);
    console.log(
      `[SAMPLE]   - Machines: ${uniqueGames.length} machines created`,
    );
    console.log(
      `[SAMPLE]   - Issues: ${dataAmount === "minimal" ? "Limited" : "Rich"} sample data from curated JSON`,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Sample data seeding failed: ${errorMessage}`);
    throw error;
  }
}
