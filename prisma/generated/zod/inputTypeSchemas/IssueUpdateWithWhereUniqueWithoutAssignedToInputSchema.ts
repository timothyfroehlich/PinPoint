import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutAssignedToInputSchema } from "./IssueUpdateWithoutAssignedToInputSchema";
import { IssueUncheckedUpdateWithoutAssignedToInputSchema } from "./IssueUncheckedUpdateWithoutAssignedToInputSchema";

export const IssueUpdateWithWhereUniqueWithoutAssignedToInputSchema: z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutAssignedToInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => IssueUpdateWithoutAssignedToInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutAssignedToInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateWithWhereUniqueWithoutAssignedToInput>;

export default IssueUpdateWithWhereUniqueWithoutAssignedToInputSchema;
