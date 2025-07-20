import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { NullableStringFieldUpdateOperationsInputSchema } from './NullableStringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { IntFieldUpdateOperationsInputSchema } from './IntFieldUpdateOperationsInputSchema';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { MachineUncheckedUpdateManyWithoutCollectionsNestedInputSchema } from './MachineUncheckedUpdateManyWithoutCollectionsNestedInputSchema';

export const CollectionUncheckedUpdateInputSchema: z.ZodType<Prisma.CollectionUncheckedUpdateInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  typeId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  locationId: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  isSmart: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  isManual: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  sortOrder: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  filterCriteria: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  machines: z.lazy(() => MachineUncheckedUpdateManyWithoutCollectionsNestedInputSchema).optional()
}).strict();

export default CollectionUncheckedUpdateInputSchema;
