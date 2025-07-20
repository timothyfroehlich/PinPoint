import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutPriorityInputSchema } from "./IssueUpdateWithoutPriorityInputSchema";
import { IssueUncheckedUpdateWithoutPriorityInputSchema } from "./IssueUncheckedUpdateWithoutPriorityInputSchema";
import { IssueCreateWithoutPriorityInputSchema } from "./IssueCreateWithoutPriorityInputSchema";
import { IssueUncheckedCreateWithoutPriorityInputSchema } from "./IssueUncheckedCreateWithoutPriorityInputSchema";

export const IssueUpsertWithWhereUniqueWithoutPriorityInputSchema: z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutPriorityInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => IssueUpdateWithoutPriorityInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutPriorityInputSchema),
      ]),
      create: z.union([
        z.lazy(() => IssueCreateWithoutPriorityInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutPriorityInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutPriorityInput>;

export default IssueUpsertWithWhereUniqueWithoutPriorityInputSchema;
