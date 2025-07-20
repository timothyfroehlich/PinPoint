import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationCreateWithoutIssueHistoryInputSchema } from "./OrganizationCreateWithoutIssueHistoryInputSchema";
import { OrganizationUncheckedCreateWithoutIssueHistoryInputSchema } from "./OrganizationUncheckedCreateWithoutIssueHistoryInputSchema";
import { OrganizationCreateOrConnectWithoutIssueHistoryInputSchema } from "./OrganizationCreateOrConnectWithoutIssueHistoryInputSchema";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";

export const OrganizationCreateNestedOneWithoutIssueHistoryInputSchema: z.ZodType<Prisma.OrganizationCreateNestedOneWithoutIssueHistoryInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => OrganizationCreateWithoutIssueHistoryInputSchema),
          z.lazy(
            () => OrganizationUncheckedCreateWithoutIssueHistoryInputSchema,
          ),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => OrganizationCreateOrConnectWithoutIssueHistoryInputSchema)
        .optional(),
      connect: z.lazy(() => OrganizationWhereUniqueInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateNestedOneWithoutIssueHistoryInput>;

export default OrganizationCreateNestedOneWithoutIssueHistoryInputSchema;
