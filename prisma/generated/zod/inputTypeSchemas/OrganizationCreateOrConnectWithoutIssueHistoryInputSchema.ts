import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationWhereUniqueInputSchema } from "./OrganizationWhereUniqueInputSchema";
import { OrganizationCreateWithoutIssueHistoryInputSchema } from "./OrganizationCreateWithoutIssueHistoryInputSchema";
import { OrganizationUncheckedCreateWithoutIssueHistoryInputSchema } from "./OrganizationUncheckedCreateWithoutIssueHistoryInputSchema";

export const OrganizationCreateOrConnectWithoutIssueHistoryInputSchema: z.ZodType<Prisma.OrganizationCreateOrConnectWithoutIssueHistoryInput> =
  z
    .object({
      where: z.lazy(() => OrganizationWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutIssueHistoryInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutIssueHistoryInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.OrganizationCreateOrConnectWithoutIssueHistoryInput>;

export default OrganizationCreateOrConnectWithoutIssueHistoryInputSchema;
