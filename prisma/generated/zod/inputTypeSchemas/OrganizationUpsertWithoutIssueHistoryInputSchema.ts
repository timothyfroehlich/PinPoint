import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { OrganizationUpdateWithoutIssueHistoryInputSchema } from "./OrganizationUpdateWithoutIssueHistoryInputSchema";
import { OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema } from "./OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema";
import { OrganizationCreateWithoutIssueHistoryInputSchema } from "./OrganizationCreateWithoutIssueHistoryInputSchema";
import { OrganizationUncheckedCreateWithoutIssueHistoryInputSchema } from "./OrganizationUncheckedCreateWithoutIssueHistoryInputSchema";
import { OrganizationWhereInputSchema } from "./OrganizationWhereInputSchema";

export const OrganizationUpsertWithoutIssueHistoryInputSchema: z.ZodType<Prisma.OrganizationUpsertWithoutIssueHistoryInput> =
  z
    .object({
      update: z.union([
        z.lazy(() => OrganizationUpdateWithoutIssueHistoryInputSchema),
        z.lazy(() => OrganizationUncheckedUpdateWithoutIssueHistoryInputSchema),
      ]),
      create: z.union([
        z.lazy(() => OrganizationCreateWithoutIssueHistoryInputSchema),
        z.lazy(() => OrganizationUncheckedCreateWithoutIssueHistoryInputSchema),
      ]),
      where: z.lazy(() => OrganizationWhereInputSchema).optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUpsertWithoutIssueHistoryInput>;

export default OrganizationUpsertWithoutIssueHistoryInputSchema;
