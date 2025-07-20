import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentWhereUniqueInputSchema } from "./AttachmentWhereUniqueInputSchema";
import { AttachmentUpdateWithoutIssueInputSchema } from "./AttachmentUpdateWithoutIssueInputSchema";
import { AttachmentUncheckedUpdateWithoutIssueInputSchema } from "./AttachmentUncheckedUpdateWithoutIssueInputSchema";

export const AttachmentUpdateWithWhereUniqueWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentUpdateWithWhereUniqueWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => AttachmentWhereUniqueInputSchema),
      data: z.union([
        z.lazy(() => AttachmentUpdateWithoutIssueInputSchema),
        z.lazy(() => AttachmentUncheckedUpdateWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.AttachmentUpdateWithWhereUniqueWithoutIssueInput>;

export default AttachmentUpdateWithWhereUniqueWithoutIssueInputSchema;
