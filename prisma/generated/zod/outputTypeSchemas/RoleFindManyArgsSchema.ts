import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RoleIncludeSchema } from "../inputTypeSchemas/RoleIncludeSchema";
import { RoleWhereInputSchema } from "../inputTypeSchemas/RoleWhereInputSchema";
import { RoleOrderByWithRelationInputSchema } from "../inputTypeSchemas/RoleOrderByWithRelationInputSchema";
import { RoleWhereUniqueInputSchema } from "../inputTypeSchemas/RoleWhereUniqueInputSchema";
import { RoleScalarFieldEnumSchema } from "../inputTypeSchemas/RoleScalarFieldEnumSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { MembershipFindManyArgsSchema } from "../outputTypeSchemas/MembershipFindManyArgsSchema";
import { PermissionFindManyArgsSchema } from "../outputTypeSchemas/PermissionFindManyArgsSchema";
import { RoleCountOutputTypeArgsSchema } from "../outputTypeSchemas/RoleCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const RoleSelectSchema: z.ZodType<Prisma.RoleSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    memberships: z
      .union([z.boolean(), z.lazy(() => MembershipFindManyArgsSchema)])
      .optional(),
    permissions: z
      .union([z.boolean(), z.lazy(() => PermissionFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => RoleCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const RoleFindManyArgsSchema: z.ZodType<Prisma.RoleFindManyArgs> = z
  .object({
    select: RoleSelectSchema.optional(),
    include: z.lazy(() => RoleIncludeSchema).optional(),
    where: RoleWhereInputSchema.optional(),
    orderBy: z
      .union([
        RoleOrderByWithRelationInputSchema.array(),
        RoleOrderByWithRelationInputSchema,
      ])
      .optional(),
    cursor: RoleWhereUniqueInputSchema.optional(),
    take: z.number().optional(),
    skip: z.number().optional(),
    distinct: z
      .union([RoleScalarFieldEnumSchema, RoleScalarFieldEnumSchema.array()])
      .optional(),
  })
  .strict() as z.ZodType<Prisma.RoleFindManyArgs>;

export default RoleFindManyArgsSchema;
