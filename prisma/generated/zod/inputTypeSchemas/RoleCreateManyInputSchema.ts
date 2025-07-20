import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const RoleCreateManyInputSchema: z.ZodType<Prisma.RoleCreateManyInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.RoleCreateManyInput>;

export default RoleCreateManyInputSchema;
