import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { ActivityTypeSchema } from "./ActivityTypeSchema";
import { EnumActivityTypeFieldUpdateOperationsInputSchema } from "./EnumActivityTypeFieldUpdateOperationsInputSchema";

export const IssueHistoryUncheckedUpdateManyWithoutActorInputSchema: z.ZodType<Prisma.IssueHistoryUncheckedUpdateManyWithoutActorInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      field: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      oldValue: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      newValue: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      changedAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      organizationId: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      type: z
        .union([
          z.lazy(() => ActivityTypeSchema),
          z.lazy(() => EnumActivityTypeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      issueId: z
        .union([
          z.string(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
    })
    .strict() as z.ZodType<Prisma.IssueHistoryUncheckedUpdateManyWithoutActorInput>;

export default IssueHistoryUncheckedUpdateManyWithoutActorInputSchema;
