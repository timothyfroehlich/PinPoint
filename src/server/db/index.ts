import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env["DATABASE_URL"]) {
  throw new Error(
    "DATABASE_URL is not set. Please set it in your .env.local file."
  );
}

// Create postgres connection
const queryClient = postgres(process.env["DATABASE_URL"]);

// Create Drizzle instance with schema
export const db = drizzle(queryClient, { schema });
