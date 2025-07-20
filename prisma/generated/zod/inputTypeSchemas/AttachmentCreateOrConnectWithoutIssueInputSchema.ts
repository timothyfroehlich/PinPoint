import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentWhereUniqueInputSchema } from "./AttachmentWhereUniqueInputSchema";
import { AttachmentCreateWithoutIssueInputSchema } from "./AttachmentCreateWithoutIssueInputSchema";
import { AttachmentUncheckedCreateWithoutIssueInputSchema } from "./AttachmentUncheckedCreateWithoutIssueInputSchema";

export const AttachmentCreateOrConnectWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentCreateOrConnectWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => AttachmentWhereUniqueInputSchema),
      create: z.union([
        z.lazy(() => AttachmentCreateWithoutIssueInputSchema),
        z.lazy(() => AttachmentUncheckedCreateWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.AttachmentCreateOrConnectWithoutIssueInput>;

export default AttachmentCreateOrConnectWithoutIssueInputSchema;
