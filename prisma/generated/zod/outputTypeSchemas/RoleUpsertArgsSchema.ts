import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { RoleIncludeSchema } from "../inputTypeSchemas/RoleIncludeSchema";
import { RoleWhereUniqueInputSchema } from "../inputTypeSchemas/RoleWhereUniqueInputSchema";
import { RoleCreateInputSchema } from "../inputTypeSchemas/RoleCreateInputSchema";
import { RoleUncheckedCreateInputSchema } from "../inputTypeSchemas/RoleUncheckedCreateInputSchema";
import { RoleUpdateInputSchema } from "../inputTypeSchemas/RoleUpdateInputSchema";
import { RoleUncheckedUpdateInputSchema } from "../inputTypeSchemas/RoleUncheckedUpdateInputSchema";
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

export const RoleUpsertArgsSchema: z.ZodType<Prisma.RoleUpsertArgs> = z
  .object({
    select: RoleSelectSchema.optional(),
    include: z.lazy(() => RoleIncludeSchema).optional(),
    where: RoleWhereUniqueInputSchema,
    create: z.union([RoleCreateInputSchema, RoleUncheckedCreateInputSchema]),
    update: z.union([RoleUpdateInputSchema, RoleUncheckedUpdateInputSchema]),
  })
  .strict() as z.ZodType<Prisma.RoleUpsertArgs>;

export default RoleUpsertArgsSchema;
