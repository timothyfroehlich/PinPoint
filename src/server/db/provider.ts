import { createPrismaClient, type ExtendedPrismaClient } from "~/server/db";

export class DatabaseProvider {
  private instance?: ExtendedPrismaClient;

  getClient(): ExtendedPrismaClient {
    if (!this.instance) {
      this.instance = createPrismaClient();
    }
    return this.instance;
  }

  async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      delete this.instance;
    }
  }

  // For testing purposes
  reset(): void {
    delete this.instance;
  }
}

// Singleton provider for production use
let globalProvider: DatabaseProvider | undefined;

export function getGlobalDatabaseProvider(): DatabaseProvider {
  if (!globalProvider) {
    globalProvider = new DatabaseProvider();
  }
  return globalProvider;
}
