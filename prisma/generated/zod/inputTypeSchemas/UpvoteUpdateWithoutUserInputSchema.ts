import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema } from "./IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema";

export const UpvoteUpdateWithoutUserInputSchema: z.ZodType<Prisma.UpvoteUpdateWithoutUserInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      createdAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      issue: z
        .lazy(() => IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UpvoteUpdateWithoutUserInput>;

export default UpvoteUpdateWithoutUserInputSchema;
