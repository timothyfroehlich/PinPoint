import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PermissionWhereInputSchema } from "../inputTypeSchemas/PermissionWhereInputSchema";

export const PermissionDeleteManyArgsSchema: z.ZodType<Prisma.PermissionDeleteManyArgs> =
  z
    .object({
      where: PermissionWhereInputSchema.optional(),
      limit: z.number().optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionDeleteManyArgs>;

export default PermissionDeleteManyArgsSchema;
