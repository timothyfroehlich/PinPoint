import "dotenv/config";
import { SheetsClient } from "./sheets-client";
import { setMachineMap, mapRowToIssue } from "./field-mappings";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../src/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { SyncEngine } from "./sync-engine";
import fs from "node:fs/promises";
import path from "node:path";
import { type SheetRow } from "./types";
import console from "node:console";

const SPREADSHEET_ID = process.env["MAINTENANCE_SPREADSHEET_ID"];
const CREDS_PATH = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
const CACHE_FILE = path.join(process.cwd(), ".sheets-sync-cache.json");

async function main() {
  if (!SPREADSHEET_ID || !CREDS_PATH) {
    console.error(
      "❌ MAINTENANCE_SPREADSHEET_ID or GOOGLE_APPLICATION_CREDENTIALS not found in environment"
    );
    process.exit(1);
  }
  const isExecute = process.argv.includes("--execute");
  const isInit = process.argv.includes("--init");

  if (isExecute) {
    console.log(
      "⚠️  RUNNING IN EXECUTE MODE - Changes will be written to DB and Sheet"
    );
  } else {
    console.log("ℹ️  DRY RUN MODE - No changes will be saved");
  }

  console.log("🚀 Starting Google Sheets Sync...");

  // 1. Database Connection
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) {
    console.error("❌ DATABASE_URL not found in environment");
    process.exit(1);
  }
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  // 2. Load Machines for mapping
  console.log("📂 Loading machines...");
  const machines = await db.query.machines.findMany();
  const machineMap: Record<string, string> = {};
  machines.forEach((m) => {
    machineMap[m.name] = m.initials;
  });
  setMachineMap(machineMap);

  const engine = new SyncEngine(db);

  // 3. Load Cache
  let cache: Record<string, Record<string, SheetRow>> = {};
  try {
    const cacheData = await fs.readFile(CACHE_FILE, "utf-8");
    cache = JSON.parse(cacheData) as Record<string, Record<string, SheetRow>>;
  } catch {
    if (!isInit && !isExecute) {
      console.log(
        "ℹ️  No cache file found. Run with --init to create initial state without syncing."
      );
    }
  }

  // 4. Initialize Sheets Client
  let sheets: SheetsClient;
  try {
    sheets = new SheetsClient(SPREADSHEET_ID, CREDS_PATH);
    await sheets.load();
  } catch (e: unknown) {
    const error = e as { code?: string; message?: string };
    if (
      error.code === "MODULE_NOT_FOUND" ||
      error.message?.includes("Cannot find module")
    ) {
      console.error(
        "❌ credentials.json not found. Please provide your Google Service Account key."
      );
    } else {
      console.error("❌ Error connecting to Sheets API:", error.message);
    }
    process.exit(1);
  }

  // 5. Fetch Rows
  console.log("📥 Fetching sheet data...");
  const reportedIssues = await sheets.getRows("Reported Issues");

  console.log(`✅ Found ${reportedIssues.length} rows in "Reported Issues"`);

  // Filter out empty rows (no game name)
  const validRows = reportedIssues.filter(
    (row) => row.game && row.game.trim() !== ""
  );
  console.log(
    `📋 Processing ${validRows.length} valid rows (filtered out ${reportedIssues.length - validRows.length} empty rows)`
  );

  for (const row of validRows) {
    const issue = mapRowToIssue(row);

    if (!issue) {
      console.log(
        `⚠️  Row ${row.rowIndex}: Machine "${row.game}" not found in PinPoint. Skipping.`
      );
      continue;
    }

    let dbIssue;
    if (row.pinpointId) {
      if (issue.id) {
        // UUID match
        dbIssue = await db.query.issues.findFirst({
          where: eq(schema.issues.id, issue.id),
        });
      } else {
        // Try human-readable ID match (e.g. "TNA-9")
        const match = /^([A-Z0-9]+)-(\d+)$/i.exec(row.pinpointId);
        if (match) {
          const initials = match[1]?.toUpperCase();
          const num = parseInt(match[2] ?? "0", 10);
          if (initials && num) {
            dbIssue = await db.query.issues.findFirst({
              where: sql`${schema.issues.machineInitials} = ${initials} AND ${schema.issues.issueNumber} = ${num}`,
            });
          }
        }
      }
    } else {
      // PinPoint ID missing in sheet - try to find by machine + title/description
      // This handles cases where issues were already imported but the sheet wasn't updated with IDs
      const searchTitle = issue.title.trim();
      dbIssue = await db.query.issues.findFirst({
        where: sql`${schema.issues.machineInitials} = ${issue.machineInitials} AND (${schema.issues.title} ILIKE ${searchTitle + "%"} OR ${schema.issues.description} ILIKE ${searchTitle + "%"})`,
      });

      if (dbIssue) {
        console.log(
          `🔗 Row ${row.rowIndex}: Found existing issue in DB for ${issue.machineInitials} (#${dbIssue.issueNumber}). Linking...`
        );
        if (isExecute) {
          const readableId = `${dbIssue.machineInitials}-${dbIssue.issueNumber}`;
          await sheets.updatePinPointId(
            "Reported Issues",
            row.rowIndex,
            readableId
          );
          console.log(`   ✅ Updated Sheet with ID: ${readableId}`);
        }
      }
    }

    const lastCachedRow =
      cache["Reported Issues"]?.[row.rowIndex.toString()] ?? null;
    const action = engine.determineAction(
      row,
      issue,
      dbIssue ?? null,
      lastCachedRow
    );
    let currentIssueId = dbIssue?.id;

    if (action.type === "create_in_db") {
      console.log(
        `✨ Row ${row.rowIndex}: New issue detected for ${issue.machineInitials}: "${issue.title}"`
      );
      if (isExecute) {
        currentIssueId = await engine.createInDB(issue);
        console.log(`   ✅ Created in DB: ${currentIssueId}`);

        // Fetch the full issue to get the issue number for the sheet
        const createdIssue = await db.query.issues.findFirst({
          where: eq(schema.issues.id, currentIssueId),
          columns: {
            issueNumber: true,
            machineInitials: true,
          },
        });

        if (createdIssue) {
          const readableId = `${createdIssue.machineInitials}-${createdIssue.issueNumber}`;
          await sheets.updatePinPointId(
            "Reported Issues",
            row.rowIndex,
            readableId
          );
        } else {
          // Fallback to UUID if something goes wrong (shouldn't happen)
          await sheets.updatePinPointId(
            "Reported Issues",
            row.rowIndex,
            currentIssueId
          );
        }
      }
    } else if (action.type === "update_db") {
      console.log(`🆙 Row ${row.rowIndex}: Sheet changed. Updating DB...`);
      if (isExecute) {
        await engine.updateInDB(issue);
        console.log(`   ✅ Updated DB`);
      }
    } else if (action.type === "conflict") {
      console.log(`❌ Row ${row.rowIndex}: CONFLICT - ${action.reason}`);
    } else {
      if (dbIssue) {
        console.log(
          `🔍 Row ${row.rowIndex}: Matches existing PinPoint issue #${dbIssue.issueNumber}.`
        );
      }
    }

    // Work Log Sync
    if (
      isExecute &&
      currentIssueId &&
      row.workLog &&
      row.workLog.trim() !== ""
    ) {
      const cachedWorkLog = lastCachedRow?.workLog ?? "";
      if (row.workLog !== cachedWorkLog) {
        const synced = await engine.syncWorkLog(currentIssueId, row.workLog);
        if (synced) {
          console.log(
            `   📝 Row ${row.rowIndex}: Work Log synced to issue comments`
          );
        }
      }
    }

    // Update local cache regardless if we processed it (to keep track of state)
    cache["Reported Issues"] ??= {};
    cache["Reported Issues"][row.rowIndex.toString()] = row;
  }

  // 6. Save Cache
  if (isExecute || isInit) {
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
    console.log(`📂 Cache saved to ${CACHE_FILE}`);
  }

  await client.end();
}

main().catch((erro) => console.error(erro));
