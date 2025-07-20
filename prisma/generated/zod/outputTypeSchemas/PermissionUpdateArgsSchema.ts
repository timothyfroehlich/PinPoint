import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PermissionIncludeSchema } from "../inputTypeSchemas/PermissionIncludeSchema";
import { PermissionUpdateInputSchema } from "../inputTypeSchemas/PermissionUpdateInputSchema";
import { PermissionUncheckedUpdateInputSchema } from "../inputTypeSchemas/PermissionUncheckedUpdateInputSchema";
import { PermissionWhereUniqueInputSchema } from "../inputTypeSchemas/PermissionWhereUniqueInputSchema";
import { RoleFindManyArgsSchema } from "../outputTypeSchemas/RoleFindManyArgsSchema";
import { PermissionCountOutputTypeArgsSchema } from "../outputTypeSchemas/PermissionCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const PermissionSelectSchema: z.ZodType<Prisma.PermissionSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    roles: z
      .union([z.boolean(), z.lazy(() => RoleFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => PermissionCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const PermissionUpdateArgsSchema: z.ZodType<Prisma.PermissionUpdateArgs> =
  z
    .object({
      select: PermissionSelectSchema.optional(),
      include: z.lazy(() => PermissionIncludeSchema).optional(),
      data: z.union([
        PermissionUpdateInputSchema,
        PermissionUncheckedUpdateInputSchema,
      ]),
      where: PermissionWhereUniqueInputSchema,
    })
    .strict() as z.ZodType<Prisma.PermissionUpdateArgs>;

export default PermissionUpdateArgsSchema;
