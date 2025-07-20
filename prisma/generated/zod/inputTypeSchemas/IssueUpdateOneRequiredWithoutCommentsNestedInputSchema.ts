import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutCommentsInputSchema } from "./IssueCreateWithoutCommentsInputSchema";
import { IssueUncheckedCreateWithoutCommentsInputSchema } from "./IssueUncheckedCreateWithoutCommentsInputSchema";
import { IssueCreateOrConnectWithoutCommentsInputSchema } from "./IssueCreateOrConnectWithoutCommentsInputSchema";
import { IssueUpsertWithoutCommentsInputSchema } from "./IssueUpsertWithoutCommentsInputSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateToOneWithWhereWithoutCommentsInputSchema } from "./IssueUpdateToOneWithWhereWithoutCommentsInputSchema";
import { IssueUpdateWithoutCommentsInputSchema } from "./IssueUpdateWithoutCommentsInputSchema";
import { IssueUncheckedUpdateWithoutCommentsInputSchema } from "./IssueUncheckedUpdateWithoutCommentsInputSchema";

export const IssueUpdateOneRequiredWithoutCommentsNestedInputSchema: z.ZodType<Prisma.IssueUpdateOneRequiredWithoutCommentsNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutCommentsInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutCommentsInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => IssueCreateOrConnectWithoutCommentsInputSchema)
        .optional(),
      upsert: z.lazy(() => IssueUpsertWithoutCommentsInputSchema).optional(),
      connect: z.lazy(() => IssueWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(() => IssueUpdateToOneWithWhereWithoutCommentsInputSchema),
          z.lazy(() => IssueUpdateWithoutCommentsInputSchema),
          z.lazy(() => IssueUncheckedUpdateWithoutCommentsInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateOneRequiredWithoutCommentsNestedInput>;

export default IssueUpdateOneRequiredWithoutCommentsNestedInputSchema;
