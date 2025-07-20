import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PermissionIncludeSchema } from "../inputTypeSchemas/PermissionIncludeSchema";
import { PermissionWhereInputSchema } from "../inputTypeSchemas/PermissionWhereInputSchema";
import { PermissionOrderByWithRelationInputSchema } from "../inputTypeSchemas/PermissionOrderByWithRelationInputSchema";
import { PermissionWhereUniqueInputSchema } from "../inputTypeSchemas/PermissionWhereUniqueInputSchema";
import { PermissionScalarFieldEnumSchema } from "../inputTypeSchemas/PermissionScalarFieldEnumSchema";
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

export const PermissionFindFirstArgsSchema: z.ZodType<Prisma.PermissionFindFirstArgs> =
  z
    .object({
      select: PermissionSelectSchema.optional(),
      include: z.lazy(() => PermissionIncludeSchema).optional(),
      where: PermissionWhereInputSchema.optional(),
      orderBy: z
        .union([
          PermissionOrderByWithRelationInputSchema.array(),
          PermissionOrderByWithRelationInputSchema,
        ])
        .optional(),
      cursor: PermissionWhereUniqueInputSchema.optional(),
      take: z.number().optional(),
      skip: z.number().optional(),
      distinct: z
        .union([
          PermissionScalarFieldEnumSchema,
          PermissionScalarFieldEnumSchema.array(),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.PermissionFindFirstArgs>;

export default PermissionFindFirstArgsSchema;
