import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateNestedOneWithoutPrioritiesInputSchema } from "./OrganizationCreateNestedOneWithoutPrioritiesInputSchema";

export const PriorityCreateWithoutIssuesInputSchema: z.ZodType<Prisma.PriorityCreateWithoutIssuesInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      order: z.number().int(),
      isDefault: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutPrioritiesInputSchema,
      ),
    })
    .strict() as z.ZodType<Prisma.PriorityCreateWithoutIssuesInput>;

export default PriorityCreateWithoutIssuesInputSchema;
