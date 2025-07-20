import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutStatusInputSchema } from "./IssueUpdateWithoutStatusInputSchema";
import { IssueUncheckedUpdateWithoutStatusInputSchema } from "./IssueUncheckedUpdateWithoutStatusInputSchema";

export const IssueUpdateWithWhereUniqueWithoutStatusInputSchema: z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutStatusInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateWithoutStatusInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutStatusInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutStatusInput>;

export default IssueUpdateWithWhereUniqueWithoutStatusInputSchema;
