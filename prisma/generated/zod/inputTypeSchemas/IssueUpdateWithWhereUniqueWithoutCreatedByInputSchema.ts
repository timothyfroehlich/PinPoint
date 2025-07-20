import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutCreatedByInputSchema } from "./IssueUpdateWithoutCreatedByInputSchema";
import { IssueUncheckedUpdateWithoutCreatedByInputSchema } from "./IssueUncheckedUpdateWithoutCreatedByInputSchema";

export const IssueUpdateWithWhereUniqueWithoutCreatedByInputSchema: z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutCreatedByInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateWithoutCreatedByInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutCreatedByInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutCreatedByInput>;

export default IssueUpdateWithWhereUniqueWithoutCreatedByInputSchema;
