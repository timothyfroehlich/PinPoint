import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { ActivityTypeSchema } from "./ActivityTypeSchema";

export const IssueHistoryUncheckedCreateWithoutIssueInputSchema: z.ZodType<Prisma.IssueHistoryUncheckedCreateWithoutIssueInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      field: z.string(),
      oldValue: z.string().optional().nullable(),
      newValue: z.string().optional().nullable(),
      changedAt: z.coerce.date().optional(),
      organizationId: z.string(),
      actorId: z.string().optional().nullable(),
      type: z.lazy(() => ActivityTypeSchema),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUncheckedCreateWithoutIssueInput>;

export default IssueHistoryUncheckedCreateWithoutIssueInputSchema;
