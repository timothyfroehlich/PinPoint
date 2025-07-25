import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

import { isDevelopment } from "~/lib/environment";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function createPrismaClientInternal() {
  const baseClient = new PrismaClient({
    log: isDevelopment() ? ["query", "error", "warn"] : ["error"],
  });

  // Always extend with Accelerate for consistent typing
  // In development, Accelerate operations will fall back to regular Prisma
  return baseClient.$extends(withAccelerate());
}

// Type alias for the extended Prisma client used throughout the application
export type ExtendedPrismaClient = ReturnType<
  typeof createPrismaClientInternal
>;

export const createPrismaClient = (): ExtendedPrismaClient => {
  return createPrismaClientInternal();
};
