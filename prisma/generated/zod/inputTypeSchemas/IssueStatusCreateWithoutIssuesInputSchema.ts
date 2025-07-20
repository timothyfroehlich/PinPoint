import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StatusCategorySchema } from "./StatusCategorySchema";
import { OrganizationCreateNestedOneWithoutIssueStatusesInputSchema } from "./OrganizationCreateNestedOneWithoutIssueStatusesInputSchema";

export const IssueStatusCreateWithoutIssuesInputSchema: z.ZodType<Prisma.IssueStatusCreateWithoutIssuesInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string(),
      category: z.lazy(() => StatusCategorySchema),
      isDefault: z.boolean().optional(),
      organization: z.lazy(
        () => OrganizationCreateNestedOneWithoutIssueStatusesInputSchema,
      ),
    })
    .strict() as z.ZodType<Prisma.IssueStatusCreateWithoutIssuesInput>;

export default IssueStatusCreateWithoutIssuesInputSchema;
