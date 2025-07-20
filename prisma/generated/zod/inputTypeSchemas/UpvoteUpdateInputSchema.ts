import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema } from "./IssueUpdateOneRequiredWithoutUpvotesNestedInputSchema";
import { UserUpdateOneRequiredWithoutUpvotesNestedInputSchema } from "./UserUpdateOneRequiredWithoutUpvotesNestedInputSchema";

export const UpvoteUpdateInputSchema: z.ZodType<Prisma.UpvoteUpdateInput> = z
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
    user: z
      .lazy(() => UserUpdateOneRequiredWithoutUpvotesNestedInputSchema)
      .optional(),
  })
  .strict() as z.ZodType<Prisma.UpvoteUpdateInput>;

export default UpvoteUpdateInputSchema;
