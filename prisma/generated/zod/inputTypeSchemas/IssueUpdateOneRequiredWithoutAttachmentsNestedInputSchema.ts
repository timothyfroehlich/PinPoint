import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueCreateWithoutAttachmentsInputSchema } from "./IssueCreateWithoutAttachmentsInputSchema";
import { IssueUncheckedCreateWithoutAttachmentsInputSchema } from "./IssueUncheckedCreateWithoutAttachmentsInputSchema";
import { IssueCreateOrConnectWithoutAttachmentsInputSchema } from "./IssueCreateOrConnectWithoutAttachmentsInputSchema";
import { IssueUpsertWithoutAttachmentsInputSchema } from "./IssueUpsertWithoutAttachmentsInputSchema";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueUpdateToOneWithWhereWithoutAttachmentsInputSchema } from "./IssueUpdateToOneWithWhereWithoutAttachmentsInputSchema";
import { IssueUpdateWithoutAttachmentsInputSchema } from "./IssueUpdateWithoutAttachmentsInputSchema";
import { IssueUncheckedUpdateWithoutAttachmentsInputSchema } from "./IssueUncheckedUpdateWithoutAttachmentsInputSchema";

export const IssueUpdateOneRequiredWithoutAttachmentsNestedInputSchema: z.ZodType<Prisma.IssueUpdateOneRequiredWithoutAttachmentsNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => IssueCreateWithoutAttachmentsInputSchema),
          z.lazy(() => IssueUncheckedCreateWithoutAttachmentsInputSchema),
        ])
        .optional(),
      connectOrCreate: z
        .lazy(() => IssueCreateOrConnectWithoutAttachmentsInputSchema)
        .optional(),
      upsert: z.lazy(() => IssueUpsertWithoutAttachmentsInputSchema).optional(),
      connect: z.lazy(() => IssueWhereUniqueInputSchema).optional(),
      update: z
        .union([
          z.lazy(() => IssueUpdateToOneWithWhereWithoutAttachmentsInputSchema),
          z.lazy(() => IssueUpdateWithoutAttachmentsInputSchema),
          z.lazy(() => IssueUncheckedUpdateWithoutAttachmentsInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueUpdateOneRequiredWithoutAttachmentsNestedInput>;

export default IssueUpdateOneRequiredWithoutAttachmentsNestedInputSchema;
