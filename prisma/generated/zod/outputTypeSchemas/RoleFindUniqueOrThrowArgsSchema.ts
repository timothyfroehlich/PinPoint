import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RoleIncludeSchema } from "../inputTypeSchemas/RoleIncludeSchema";
import { RoleWhereUniqueInputSchema } from "../inputTypeSchemas/RoleWhereUniqueInputSchema";
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

export const RoleFindUniqueOrThrowArgsSchema: z.ZodType<Prisma.RoleFindUniqueOrThrowArgs> =
  z
    .object({
      select: RoleSelectSchema.optional(),
      include: z.lazy(() => RoleIncludeSchema).optional(),
      where: RoleWhereUniqueInputSchema,
    })
    .strict() as z.ZodType<Prisma.RoleFindUniqueOrThrowArgs>;

export default RoleFindUniqueOrThrowArgsSchema;
