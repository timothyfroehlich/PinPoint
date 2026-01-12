import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env["DATABASE_URL"]) {
  throw new Error(
    "DATABASE_URL is not set. Please set it in your .env.local file."
  );
}

// Strip surrounding quotes if present (handles both single and double quotes)
const databaseUrl = process.env["DATABASE_URL"].replace(/^["']|["']$/g, "");

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

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export type DbTransaction = DbOrTx;
