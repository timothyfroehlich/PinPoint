import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { runInTransactionContext } from "./transaction-context";

const rawDatabaseUrl = process.env["POSTGRES_URL"];

if (!rawDatabaseUrl) {
  throw new Error(
    "Database URL is not set. Set POSTGRES_URL in .env.local or your deployment environment."
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

const baseDb = drizzle(conn, { schema });

/**
 * Tripwire (CORE-ARCH-011, the "Doodle Bug" PP-2053): run every transaction
 * callback inside the in-transaction AsyncLocalStorage context. The side-effect
 * client wrappers (email, Discord, blob, Vault RPC) assert against that context
 * and throw, so a pre-commit external call can never silently slip back in.
 * The wrapper preserves the original `transaction` type exactly.
 */
const baseTransaction = baseDb.transaction.bind(baseDb);
const wrappedTransaction: typeof baseDb.transaction = (callback, config) =>
  baseTransaction((tx) => runInTransactionContext(() => callback(tx)), config);
baseDb.transaction = wrappedTransaction;

export const db = baseDb;

export type Schema = typeof schema;

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
export type DbTransaction = DbOrTx;
