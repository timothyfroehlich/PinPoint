import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const RoleCountOutputTypeSelectSchema: z.ZodType<Prisma.RoleCountOutputTypeSelect> =
  z
    .object({
      memberships: z.boolean().optional(),
      permissions: z.boolean().optional(),
    })
    .strict();

export default RoleCountOutputTypeSelectSchema;
