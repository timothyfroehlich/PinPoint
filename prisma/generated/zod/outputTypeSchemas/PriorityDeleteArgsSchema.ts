import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PriorityIncludeSchema } from "../inputTypeSchemas/PriorityIncludeSchema";
import { PriorityWhereUniqueInputSchema } from "../inputTypeSchemas/PriorityWhereUniqueInputSchema";
import { OrganizationArgsSchema } from "../outputTypeSchemas/OrganizationArgsSchema";
import { IssueFindManyArgsSchema } from "../outputTypeSchemas/IssueFindManyArgsSchema";
import { PriorityCountOutputTypeArgsSchema } from "../outputTypeSchemas/PriorityCountOutputTypeArgsSchema";
// Select schema needs to be in file to prevent circular imports
//------------------------------------------------------

export const PrioritySelectSchema: z.ZodType<Prisma.PrioritySelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    order: z.boolean().optional(),
    organizationId: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    organization: z
      .union([z.boolean(), z.lazy(() => OrganizationArgsSchema)])
      .optional(),
    issues: z
      .union([z.boolean(), z.lazy(() => IssueFindManyArgsSchema)])
      .optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => PriorityCountOutputTypeArgsSchema)])
      .optional(),
  })
  .strict();

export const PriorityDeleteArgsSchema: z.ZodType<Prisma.PriorityDeleteArgs> = z
  .object({
    select: PrioritySelectSchema.optional(),
    include: z.lazy(() => PriorityIncludeSchema).optional(),
    where: PriorityWhereUniqueInputSchema,
  })
  .strict() as z.ZodType<Prisma.PriorityDeleteArgs>;

export default PriorityDeleteArgsSchema;
