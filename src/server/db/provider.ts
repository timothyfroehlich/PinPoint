import { createPrismaClient, type ExtendedPrismaClient } from "~/server/db";
import {
  createDrizzleClient,
  type DrizzleClient,
  closeDrizzleConnection,
} from "~/server/db/drizzle";

export class DatabaseProvider {
  private prismaInstance?: ExtendedPrismaClient;
  private drizzleInstance?: DrizzleClient;

  // Existing Prisma method (unchanged)
  getClient(): ExtendedPrismaClient {
    this.prismaInstance ??= createPrismaClient();
    return this.prismaInstance;
  }

  // New Drizzle method
  getDrizzleClient(): DrizzleClient {
    this.drizzleInstance ??= createDrizzleClient();
    return this.drizzleInstance;
  }

  // Updated for dual-ORM support
  async disconnect(): Promise<void> {
    const promises: Promise<void>[] = [closeDrizzleConnection()];
    if (this.prismaInstance) {
      promises.push(this.prismaInstance.$disconnect());
    }
    await Promise.all(promises);
    delete this.prismaInstance;
    delete this.drizzleInstance;
  }

  // For testing purposes - reset both clients
  reset(): void {
    delete this.prismaInstance;
    delete this.drizzleInstance;
  }
}

// Singleton provider for production use
let globalProvider: DatabaseProvider | undefined;

export function getGlobalDatabaseProvider(): DatabaseProvider {
  globalProvider ??= new DatabaseProvider();
  return globalProvider;
}
