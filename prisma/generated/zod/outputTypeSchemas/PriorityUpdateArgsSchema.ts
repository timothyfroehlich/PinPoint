import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { PriorityIncludeSchema } from "../inputTypeSchemas/PriorityIncludeSchema";
import { PriorityUpdateInputSchema } from "../inputTypeSchemas/PriorityUpdateInputSchema";
import { PriorityUncheckedUpdateInputSchema } from "../inputTypeSchemas/PriorityUncheckedUpdateInputSchema";
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

export const PriorityUpdateArgsSchema: z.ZodType<Prisma.PriorityUpdateArgs> = z
  .object({
    select: PrioritySelectSchema.optional(),
    include: z.lazy(() => PriorityIncludeSchema).optional(),
    data: z.union([
      PriorityUpdateInputSchema,
      PriorityUncheckedUpdateInputSchema,
    ]),
    where: PriorityWhereUniqueInputSchema,
  })
  .strict() as z.ZodType<Prisma.PriorityUpdateArgs>;

export default PriorityUpdateArgsSchema;
