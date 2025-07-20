import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { AttachmentScalarWhereInputSchema } from "./AttachmentScalarWhereInputSchema";
import { AttachmentUpdateManyMutationInputSchema } from "./AttachmentUpdateManyMutationInputSchema";
import { AttachmentUncheckedUpdateManyWithoutIssueInputSchema } from "./AttachmentUncheckedUpdateManyWithoutIssueInputSchema";

export const AttachmentUpdateManyWithWhereWithoutIssueInputSchema: z.ZodType<Prisma.AttachmentUpdateManyWithWhereWithoutIssueInput> =
  z
    .object({
      where: z.lazy(() => AttachmentScalarWhereInputSchema),
      data: z.union([
        z.lazy(() => AttachmentUpdateManyMutationInputSchema),
        z.lazy(() => AttachmentUncheckedUpdateManyWithoutIssueInputSchema),
      ]),
    })
    .strict() as z.ZodType<Prisma.AttachmentUpdateManyWithWhereWithoutIssueInput>;

export default AttachmentUpdateManyWithWhereWithoutIssueInputSchema;
