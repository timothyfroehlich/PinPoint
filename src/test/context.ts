import { PrismaClient } from "@prisma/client";

export function createTestContext(): {
  prisma: PrismaClient;
  session: undefined;
  organization: undefined;
} {
  const prisma = new PrismaClient();
  // Optionally seed test org, etc. here
  return {
    prisma,
    session: undefined,
    organization: undefined,
  };
}
