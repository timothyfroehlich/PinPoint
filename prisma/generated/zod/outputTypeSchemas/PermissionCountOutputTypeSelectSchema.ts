import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const PermissionCountOutputTypeSelectSchema: z.ZodType<Prisma.PermissionCountOutputTypeSelect> =
  z
    .object({
      roles: z.boolean().optional(),
    })
    .strict();

export default PermissionCountOutputTypeSelectSchema;
