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

import { eq, and } from "drizzle-orm";

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
async function extractUniqueGames(): Promise<UniqueGame[]> {
  try {
    // Import sample issues JSON
    const sampleIssuesModule = await import(
      "../../prisma/seeds/sample-issues.json"
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

    const uniqueGames = Array.from(gameMap.values());
    console.log(`[SAMPLE] Found ${uniqueGames.length.toString()} unique games`);

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
 * Create OPDB models from unique games
 */
async function createModels(games: UniqueGame[]): Promise<void> {
  console.log(`[SAMPLE] Creating ${games.length.toString()} OPDB models...`);

  try {
    for (const game of games) {
      // Use upsert pattern - insert if not exists, skip if exists
      const existingModel = await db
        .select({ id: models.id })
        .from(models)
        .where(eq(models.opdbId, game.opdbId))
        .limit(1);

      if (existingModel.length === 0) {
        await db.insert(models).values({
          id: `model_${game.opdbId}`, // Deterministic ID generation
          name: game.name,
          manufacturer: game.manufacturer,
          year: game.year,
          opdbId: game.opdbId,
          isCustom: false, // OPDB games are not custom
          isActive: true,
        });

        console.log(`[SAMPLE] ✅ Created model: ${game.name}`);
      } else {
        console.log(`[SAMPLE] ⏭️  Model exists: ${game.name}`);
      }
    }

    console.log(`[SAMPLE] ✅ Model creation completed`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Model creation failed: ${errorMessage}`);
    throw new Error(`Failed to create models: ${errorMessage}`);
  }
}

/**
 * Create machines for all models at the organization's location
 */
async function createMachines(
  organizationId: string,
  games: UniqueGame[],
): Promise<void> {
  console.log(
    `[SAMPLE] Creating machines for ${games.length.toString()} models...`,
  );

  try {
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

    // Create machines for each model
    let machineCount = 0;
    for (const game of games) {
      // Find the model we created
      const model = await db
        .select({ id: models.id })
        .from(models)
        .where(eq(models.opdbId, game.opdbId))
        .limit(1);

      if (model.length === 0) {
        console.warn(
          `[SAMPLE] ⚠️  Model not found for ${game.name}, skipping machine`,
        );
        continue;
      }

      const modelRecord = model[0];
      if (!modelRecord) {
        console.warn(
          `[SAMPLE] ⚠️  Model record unexpectedly undefined for ${game.name}, skipping machine`,
        );
        continue;
      }
      const modelId = modelRecord.id;

      // Check if machine already exists
      const existingMachine = await db
        .select({ id: machines.id })
        .from(machines)
        .where(
          and(
            eq(machines.organizationId, organizationId),
            eq(machines.locationId, locationId),
            eq(machines.modelId, modelId),
          ),
        )
        .limit(1);

      if (existingMachine.length === 0) {
        machineCount++;
        const qrCodeId = `qr-${game.name.toLowerCase().replace(/\s+/g, "-")}-${machineCount}`;

        await db.insert(machines).values({
          id: `machine_${modelId}_${locationId}`, // Deterministic ID
          name: `${game.name} #${machineCount}`,
          organizationId,
          locationId,
          modelId,
          ownerId,
          qrCodeId,
          ownerNotificationsEnabled: true,
          notifyOnNewIssues: true,
          notifyOnStatusChanges: true,
          notifyOnComments: false,
        });

        console.log(
          `[SAMPLE] ✅ Created machine: ${game.name} #${machineCount}`,
        );
      } else {
        console.log(`[SAMPLE] ⏭️  Machine exists: ${game.name}`);
      }
    }

    console.log(
      `[SAMPLE] ✅ Machine creation completed (${machineCount} machines)`,
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
 * Create sample issues mapped to machines
 */
async function createSampleIssues(organizationId: string): Promise<void> {
  try {
    // Import sample issues JSON
    const sampleIssuesModule = await import(
      "../../prisma/seeds/sample-issues.json"
    );
    const sampleIssues: SampleIssue[] = sampleIssuesModule.default;

    console.log(
      `[SAMPLE] Creating ${sampleIssues.length.toString()} sample issues...`,
    );

    // Get priority and status mappings
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

    // Get user mappings for creators
    const userMap = new Map<string, string>();
    const allUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users);

    for (const user of allUsers) {
      if (user.email) {
        userMap.set(user.email, user.id);
      }
    }

    // Create issues
    let issueCount = 0;
    let skippedCount = 0;

    for (const issueData of sampleIssues) {
      try {
        // Find machine by OPDB ID
        const machine = await db
          .select({
            id: machines.id,
            name: machines.name,
            model: {
              name: models.name,
              opdbId: models.opdbId,
            },
          })
          .from(machines)
          .innerJoin(models, eq(machines.modelId, models.id))
          .where(
            and(
              eq(machines.organizationId, organizationId),
              eq(models.opdbId, issueData.gameOpdbId),
            ),
          )
          .limit(1);

        if (machine.length === 0) {
          console.warn(
            `[SAMPLE] ⚠️  Machine not found for OPDB ID ${issueData.gameOpdbId}, skipping issue`,
          );
          skippedCount++;
          continue;
        }

        const machineRecord = machine[0];
        if (!machineRecord) {
          console.warn(
            `[SAMPLE] ⚠️  Machine record unexpectedly undefined for OPDB ID ${issueData.gameOpdbId}, skipping issue`,
          );
          skippedCount++;
          continue;
        }
        const machineId = machineRecord.id;

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

        // Map creator
        const createdById = userMap.get(issueData.reporterEmail);
        if (!createdById) {
          console.warn(
            `[SAMPLE] ⚠️  User '${issueData.reporterEmail}' not found, skipping issue`,
          );
          skippedCount++;
          continue;
        }

        // Check if issue already exists (basic duplicate prevention)
        const existingIssue = await db
          .select({ id: issues.id })
          .from(issues)
          .where(
            and(
              eq(issues.organizationId, organizationId),
              eq(issues.machineId, machineId),
              eq(issues.title, issueData.title),
            ),
          )
          .limit(1);

        if (existingIssue.length === 0) {
          await db.insert(issues).values({
            id: `issue_${issueCount}_${Date.now()}`, // Unique ID
            title: issueData.title,
            description: issueData.description,
            consistency: issueData.consistency,
            organizationId,
            machineId,
            statusId,
            priorityId,
            createdById,
            createdAt: new Date(issueData.createdAt),
            updatedAt: new Date(issueData.updatedAt),
          });

          issueCount++;
          console.log(`[SAMPLE] ✅ Created issue: ${issueData.title}`);
        } else {
          console.log(`[SAMPLE] ⏭️  Issue exists: ${issueData.title}`);
        }
      } catch (error) {
        console.warn(
          `[SAMPLE] ⚠️  Failed to create issue '${issueData.title}':`,
          error,
        );
        skippedCount++;
      }
    }

    console.log(
      `[SAMPLE] ✅ Issue creation completed: ${issueCount} created, ${skippedCount} skipped`,
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
export async function seedSampleData(organizationId: string): Promise<void> {
  console.log(
    `[SAMPLE] 🎮 Starting sample data seeding for organization ${organizationId}...`,
  );

  try {
    // Phase 1: Extract unique games from sample issues
    const uniqueGames = await extractUniqueGames();

    // Phase 2: Create OPDB models
    await createModels(uniqueGames);

    // Phase 3: Create machines for all models
    await createMachines(organizationId, uniqueGames);

    // Phase 4: Create sample issues mapped to machines
    await createSampleIssues(organizationId);

    console.log(`[SAMPLE] ✅ Sample data seeding completed successfully!`);
    console.log(`[SAMPLE] 📊 Summary:`);
    console.log(`[SAMPLE]   - Games: ${uniqueGames.length} unique OPDB models`);
    console.log(
      `[SAMPLE]   - Machines: ${uniqueGames.length} machines created`,
    );
    console.log(`[SAMPLE]   - Issues: Rich sample data from curated JSON`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SAMPLE] ❌ Sample data seeding failed: ${errorMessage}`);
    throw error;
  }
}
