import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { IssueCreateNestedManyWithoutStatusInputSchema } from "./IssueCreateNestedManyWithoutStatusInputSchema";

export const IssueStatusCreateWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusCreateWithoutOrganizationInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      category: z.lazy(() => StatusCategorySchema),
      isDefault: z.boolean().optional(),
      issues: z
        .lazy(() => IssueCreateNestedManyWithoutStatusInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateWithoutOrganizationInput>;

export default IssueStatusCreateWithoutOrganizationInputSchema;
