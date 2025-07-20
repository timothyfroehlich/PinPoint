import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { StatusCategorySchema } from './StatusCategorySchema';
import { EnumStatusCategoryFieldUpdateOperationsInputSchema } from './EnumStatusCategoryFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { IssueUncheckedUpdateManyWithoutStatusNestedInputSchema } from './IssueUncheckedUpdateManyWithoutStatusNestedInputSchema';

export const IssueStatusUncheckedUpdateWithoutOrganizationInputSchema: z.ZodType<Prisma.IssueStatusUncheckedUpdateWithoutOrganizationInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  category: z.union([ z.lazy(() => StatusCategorySchema),z.lazy(() => EnumStatusCategoryFieldUpdateOperationsInputSchema) ]).optional(),
  isDefault: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  issues: z.lazy(() => IssueUncheckedUpdateManyWithoutStatusNestedInputSchema).optional()
}).strict();

export default IssueStatusUncheckedUpdateWithoutOrganizationInputSchema;
