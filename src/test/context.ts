import { PrismaClient } from "@prisma/client";

export function createTestContext() {
  const prisma = new PrismaClient();
  // Optionally seed test org, etc. here
  return {
    prisma,
    session: undefined,
    organization: undefined,
  };
}
