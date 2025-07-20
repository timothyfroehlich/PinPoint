import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateWithoutCreatedByInputSchema } from "./IssueUpdateWithoutCreatedByInputSchema";
import { IssueUncheckedUpdateWithoutCreatedByInputSchema } from "./IssueUncheckedUpdateWithoutCreatedByInputSchema";
import { IssueCreateWithoutCreatedByInputSchema } from "./IssueCreateWithoutCreatedByInputSchema";
import { IssueUncheckedCreateWithoutCreatedByInputSchema } from "./IssueUncheckedCreateWithoutCreatedByInputSchema";

export const IssueUpsertWithWhereUniqueWithoutCreatedByInputSchema: z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutCreatedByInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      update: z.union([
        z.lazy(() => IssueUpdateWithoutCreatedByInputSchema),
        z.lazy(() => IssueUncheckedUpdateWithoutCreatedByInputSchema),
      ]),
      create: z.union([
        z.lazy(() => IssueCreateWithoutCreatedByInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutCreatedByInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueUpsertWithWhereUniqueWithoutCreatedByInput>;

export default IssueUpsertWithWhereUniqueWithoutCreatedByInputSchema;
