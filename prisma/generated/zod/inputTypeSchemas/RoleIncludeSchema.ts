import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { MembershipFindManyArgsSchema } from "../outputTypeSchemas/MembershipFindManyArgsSchema";
import { PermissionFindManyArgsSchema } from "../outputTypeSchemas/PermissionFindManyArgsSchema";
import { RoleCountOutputTypeArgsSchema } from "../outputTypeSchemas/RoleCountOutputTypeArgsSchema";

export const RoleIncludeSchema: z.ZodType<Prisma.RoleInclude> = z
  .object({
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

export default RoleIncludeSchema;
