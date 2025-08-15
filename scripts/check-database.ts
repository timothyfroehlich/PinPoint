import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import "./lib/env-loaders/development";
import * as schema from "../src/server/db/schema";

const sql = postgres(
  process.env.DATABASE_URL ??
    "postgresql://postgres:postgres@localhost:54322/postgres",
);
const db = drizzle(sql, { schema });

async function checkGames() {
  console.log("=== Available Models ===");
  const models = await db.query.models.findMany({
    columns: { name: true, opdbId: true },
  });

  models.forEach((game, index) => {
    console.log(`${index + 1}. ${game.name} (${game.opdbId})`);
  });

  console.log("\n=== Available Machines ===");
  const machines = await db.query.machines.findMany({
    with: {
      model: {
        columns: { name: true },
      },
    },
  });

  machines.forEach((machine, index) => {
    console.log(`${index + 1}. Machine (Model: ${machine.model.name})`);
  });

  console.log("\n=== Available Statuses ===");
  const statuses = await db.query.issueStatuses.findMany({
    columns: { name: true, category: true },
  });

  statuses.forEach((status, index) => {
    console.log(`${index + 1}. ${status.name} (Category: ${status.category})`);
  });

  console.log("\n=== Created Issues ===");
  const issues = await db.query.issues.findMany({
    with: {
      machine: {
        with: {
          model: {
            columns: { name: true },
          },
        },
      },
      status: {
        columns: { name: true },
      },
    },
  });

  issues.forEach((issue, index) => {
    console.log(
      `${index + 1}. ${issue.title} - Machine: ${issue.machine.model.name} - Status: ${issue.status.name}`,
    );
  });
}

checkGames()
  .catch(console.error)
  .finally(() => void sql.end());
