import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";

export const IssueStatusCreateManyInputSchema: z.ZodType<Prisma.IssueStatusCreateManyInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      category: z.lazy(() => StatusCategorySchema),
      organizationId: z.string(),
      isDefault: z.boolean().optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateManyInput>;

export default IssueStatusCreateManyInputSchema;
