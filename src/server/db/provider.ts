import {
  createDrizzleClient,
  type DrizzleClient,
  closeDrizzleConnection,
} from "~/server/db/drizzle";

export class DatabaseProvider {
  private drizzleInstance?: DrizzleClient;

  // Single Drizzle client method (renamed from getDrizzleClient)
  getClient(): DrizzleClient {
    this.drizzleInstance ??= createDrizzleClient();
    return this.drizzleInstance;
  }

  // Drizzle-only disconnect
  async disconnect(): Promise<void> {
    await closeDrizzleConnection();
    delete this.drizzleInstance;
  }

  // For testing purposes - reset Drizzle client
  reset(): void {
    delete this.drizzleInstance;
  }
}

// Singleton provider for production use
let globalProvider: DatabaseProvider | undefined;

export function getGlobalDatabaseProvider(): DatabaseProvider {
  globalProvider ??= new DatabaseProvider();
  return globalProvider;
}
