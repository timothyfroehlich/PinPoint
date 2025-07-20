import type { Prisma } from "@prisma/client";

import { z } from "zod";

export const PermissionCreateWithoutRolesInputSchema: z.ZodType<Prisma.PermissionCreateWithoutRolesInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
    })
    .strict() as z.ZodType<Prisma.PermissionCreateWithoutRolesInput>;

export default PermissionCreateWithoutRolesInputSchema;
