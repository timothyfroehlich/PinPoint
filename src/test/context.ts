import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "~/server/db/schema";

export function createTestContext(): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  session: undefined;
  organization: undefined;
} {
  // For tests, use a mock pool that doesn't actually connect
  const mockPool = new Pool({ connectionString: "postgresql://mock" });
  const db = drizzle(mockPool, { schema });

  // Optionally seed test org, etc. here
  return {
    db,
    session: undefined,
    organization: undefined,
  };
}
