import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { MembershipIncludeSchema } from "../inputTypeSchemas/MembershipIncludeSchema";
import { MembershipUpdateInputSchema } from "../inputTypeSchemas/MembershipUpdateInputSchema";
import { MembershipUncheckedUpdateInputSchema } from "../inputTypeSchemas/MembershipUncheckedUpdateInputSchema";
import { MembershipWhereUniqueInputSchema } from "../inputTypeSchemas/MembershipWhereUniqueInputSchema";
import { UserArgsSchema } from "../outputTypeSchemas/UserArgsSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { RoleArgsSchema } from "../outputTypeSchemas/RoleArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const MembershipSelectSchema: z.ZodType<Prisma.MembershipSelect> = z
  .object({
    id: z.boolean().optional(),
    userId: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    roleId: z.boolean().optional(),
    user: z.union([z.boolean(), z.lazy(() => UserArgsSchema)]).optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    role: z.union([z.boolean(), z.lazy(() => RoleArgsSchema)]).optional(),
  })
  .strict();

export const MembershipUpdateArgsSchema: z.ZodType<Prisma.MembershipUpdateArgs> =
  z
    .object({
      select: MembershipSelectSchema.optional(),
      include: z.lazy(() => MembershipIncludeSchema).optional(),
      data: z.union([
        MembershipUpdateInputSchema,
        MembershipUncheckedUpdateInputSchema,
      ]),
      where: MembershipWhereUniqueInputSchema,
    })
    .strict() as z.ZodType<Prisma.MembershipUpdateArgs>;

export default MembershipUpdateArgsSchema;
