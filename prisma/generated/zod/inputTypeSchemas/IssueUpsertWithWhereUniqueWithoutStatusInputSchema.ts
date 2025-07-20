import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutStatusInputSchema } from "./IssueUpdateWithoutStatusInputSchema";
import { IssueUncheckedUpdateWithoutStatusInputSchema } from "./IssueUncheckedUpdateWithoutStatusInputSchema";
import { IssueCreateWithoutStatusInputSchema } from "./IssueCreateWithoutStatusInputSchema";
import { IssueUncheckedCreateWithoutStatusInputSchema } from "./IssueUncheckedCreateWithoutStatusInputSchema";

export const IssueUpsertWithWhereUniqueWithoutStatusInputSchema: z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutStatusInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => IssueUpdateWithoutStatusInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutStatusInputSchema),
      ]),
      create: z.union([
        z.lazy(() => IssueCreateWithoutStatusInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutStatusInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutStatusInput>;

export default IssueUpsertWithWhereUniqueWithoutStatusInputSchema;
