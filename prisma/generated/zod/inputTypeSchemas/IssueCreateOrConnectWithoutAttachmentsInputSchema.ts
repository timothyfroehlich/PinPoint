import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { IssueWhereUniqueInputSchema } from "./IssueWhereUniqueInputSchema";
import { IssueCreateWithoutAttachmentsInputSchema } from "./IssueCreateWithoutAttachmentsInputSchema";
import { IssueUncheckedCreateWithoutAttachmentsInputSchema } from "./IssueUncheckedCreateWithoutAttachmentsInputSchema";

export const IssueCreateOrConnectWithoutAttachmentsInputSchema: z.ZodType<Prisma.IssueCreateOrConnectWithoutAttachmentsInput> =
  z
    .object({
      where: z.lazy(() => IssueWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => IssueCreateWithoutAttachmentsInputSchema),
        z.lazy(() => IssueUncheckedCreateWithoutAttachmentsInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.IssueCreateOrConnectWithoutAttachmentsInput>;

export default IssueCreateOrConnectWithoutAttachmentsInputSchema;
