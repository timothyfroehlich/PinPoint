import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Supabase Vercel integration sets POSTGRES_URL; local dev uses DATABASE_URL
const rawDatabaseUrl =
  process.env["POSTGRES_URL"] ?? process.env["DATABASE_URL"];

if (!rawDatabaseUrl) {
  throw new Error(
    "Database URL is not set. Set POSTGRES_URL (Supabase integration) or DATABASE_URL (.env.local)."
  );
}

// Strip surrounding quotes if present (handles both single and double quotes)
const databaseUrl = rawDatabaseUrl.replace(/^["']|["']$/g, "");

/**
 * Persist the database connection across hot reloads in development.
 * This prevents reaching the connection limit (CORE-TEST-001).
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

const conn = globalForDb.conn ?? postgres(databaseUrl);
if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;

export const db = drizzle(conn, { schema });

export type Schema = typeof schema;

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export type DbTransaction = DbOrTx;
