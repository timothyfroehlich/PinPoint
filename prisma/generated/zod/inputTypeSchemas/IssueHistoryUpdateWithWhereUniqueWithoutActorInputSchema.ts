import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueHistoryWhereUniqueInputSchema } from "./IssueHistoryWhereUniqueInputSchema";
import { IssueHistoryUpdateWithoutActorInputSchema } from "./IssueHistoryUpdateWithoutActorInputSchema";
import { IssueHistoryUncheckedUpdateWithoutActorInputSchema } from "./IssueHistoryUncheckedUpdateWithoutActorInputSchema";

export const IssueHistoryUpdateWithWhereUniqueWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryUpdateWithWhereUniqueWithoutActorInput> =
  z
    .object({
      where: z.lazy(() => IssueHistoryWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => IssueHistoryUpdateWithoutActorInputSchema),
        z.lazy(() => IssueHistoryUncheckedUpdateWithoutActorInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUpdateWithWhereUniqueWithoutActorInput>;

export default IssueHistoryUpdateWithWhereUniqueWithoutActorInputSchema;
