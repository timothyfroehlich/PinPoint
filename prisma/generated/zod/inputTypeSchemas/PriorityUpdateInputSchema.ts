import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { IntFieldUpdateOperationsInputSchema } from './IntFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { OrganizationUpdateOneRequiredWithoutPrioritiesNestedInputSchema } from './OrganizationUpdateOneRequiredWithoutPrioritiesNestedInputSchema';
import { IssueUpdateManyWithoutPriorityNestedInputSchema } from './IssueUpdateManyWithoutPriorityNestedInputSchema';

export const PriorityUpdateInputSchema: z.ZodType<Prisma.PriorityUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  order: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  isDefault: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  organization: z.lazy(() => OrganizationUpdateOneRequiredWithoutPrioritiesNestedInputSchema).optional(),
  issues: z.lazy(() => IssueUpdateManyWithoutPriorityNestedInputSchema).optional()
}).strict();

export default PriorityUpdateInputSchema;
