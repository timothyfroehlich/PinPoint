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
      this.instance = undefined;
    }
  }

  // For testing purposes
  reset(): void {
    this.instance = undefined;
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
