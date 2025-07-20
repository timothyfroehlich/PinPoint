import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryWhereUniqueInputSchema } from "./IssueHistoryWhereUniqueInputSchema";
import { IssueHistoryUpdateWithoutOrganizationInputSchema } from "./IssueHistoryUpdateWithoutOrganizationInputSchema";
import { IssueHistoryUncheckedUpdateWithoutOrganizationInputSchema } from "./IssueHistoryUncheckedUpdateWithoutOrganizationInputSchema";

export const IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInput> =
  z
    .object({
      where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => IssueHistoryUpdateWithoutOrganizationInputSchema),
        z.lazy(() => IssueHistoryUncheckedUpdateWithoutOrganizationInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInput>;

export default IssueHistoryUpdateWithWhereUniqueWithoutOrganizationInputSchema;
