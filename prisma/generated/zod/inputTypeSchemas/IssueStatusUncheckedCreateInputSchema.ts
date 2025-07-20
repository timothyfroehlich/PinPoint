import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { IssueUncheckedCreateNestedManyWithoutStatusInputSchema } from "./IssueUncheckedCreateNestedManyWithoutStatusInputSchema";

export const IssueStatusUncheckedCreateInputSchema: z.ZodType<Prisma.IssueStatusUncheckedCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      category: z.lazy(() => StatusCategorySchema),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
      issues: z
        .lazy(() => IssueUncheckedCreateNestedManyWithoutStatusInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusUncheckedCreateInput>;

export default IssueStatusUncheckedCreateInputSchema;
