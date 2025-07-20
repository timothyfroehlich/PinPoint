import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { IntFieldUpdateOperationsInputSchema } from './IntFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { IssueUncheckedUpdateManyWithoutPriorityNestedInputSchema } from './IssueUncheckedUpdateManyWithoutPriorityNestedInputSchema';

export const PriorityUncheckedUpdateWithoutOrganizationInputSchema: z.ZodType<Prisma.PriorityUncheckedUpdateWithoutOrganizationInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  order: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  isDefault: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  issues: z.lazy(() => IssueUncheckedUpdateManyWithoutPriorityNestedInputSchema).optional()
}).strict();

export default PriorityUncheckedUpdateWithoutOrganizationInputSchema;
