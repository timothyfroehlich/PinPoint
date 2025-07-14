import { PrismaClient } from "@prisma/client";

export async function createTestContext() {
  const prisma = new PrismaClient();
  // Optionally seed test org, etc. here
  return {
    prisma,
    session: undefined,
    organization: undefined,
  };
}
