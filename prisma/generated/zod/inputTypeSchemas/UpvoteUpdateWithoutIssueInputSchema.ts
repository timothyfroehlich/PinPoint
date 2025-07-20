import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { DateTimeFieldUpdateOperationsInputSchema } from './DateTimeFieldUpdateOperationsInputSchema';
import { UserUpdateOneRequiredWithoutUpvotesNestedInputSchema } from './UserUpdateOneRequiredWithoutUpvotesNestedInputSchema';

export const UpvoteUpdateWithoutIssueInputSchema: z.ZodType<Prisma.UpvoteUpdateWithoutIssueInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  createdAt: z.union([ z.coerce.date(),z.lazy(() => DateTimeFieldUpdateOperationsInputSchema) ]).optional(),
  user: z.lazy(() => UserUpdateOneRequiredWithoutUpvotesNestedInputSchema).optional()
}).strict();

export default UpvoteUpdateWithoutIssueInputSchema;
