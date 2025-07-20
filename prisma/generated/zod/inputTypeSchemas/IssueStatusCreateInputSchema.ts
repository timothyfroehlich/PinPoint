import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { OrganizationCreateNestedOneWithoutIssueStatusesInputSchema } from "./OrganizationCreateNestedOneWithoutIssueStatusesInputSchema";
import { IssueCreateNestedManyWithoutStatusInputSchema } from "./IssueCreateNestedManyWithoutStatusInputSchema";

export const IssueStatusCreateInputSchema: z.ZodType<Prisma.IssueStatusCreateInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      category: z.lazy(() => StatusCategorySchema),
      isDefault: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutIssueStatusesInputSchema,
      ),
      issues: z
        .lazy(() => IssueCreateNestedManyWithoutStatusInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateInput>;

export default IssueStatusCreateInputSchema;
