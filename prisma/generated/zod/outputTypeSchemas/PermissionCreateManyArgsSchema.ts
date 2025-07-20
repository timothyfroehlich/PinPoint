import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PermissionCreateManyInputSchema } from "../inputTypeSchemas/PermissionCreateManyInputSchema";

export const PermissionCreateManyArgsSchema: z.ZodType<Prisma.PermissionCreateManyArgs> =
  z
    .object({
      data: z.union([
        PermissionCreateManyInputSchema,
        PermissionCreateManyInputSchema.array(),
      ]),
      skipDuplicates: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionCreateManyArgs>;

export default PermissionCreateManyArgsSchema;
