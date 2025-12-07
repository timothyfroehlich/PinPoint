import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Strip surrounding quotes if present (handles both single and double quotes)
const databaseUrl = process.env["DATABASE_URL"]
  ? process.env["DATABASE_URL"].replace(/^["']|["']$/g, "")
  : "postgres://default:default@localhost:5432/default"; // Fallback for build time

if (!process.env["DATABASE_URL"]) {
  console.warn(
    "DATABASE_URL is not set. Using dummy connection string. This is only safe during build if no queries are executed."
  );
}

// Create postgres connection
const queryClient = postgres(databaseUrl);

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export type DbTransaction = DbOrTx;
