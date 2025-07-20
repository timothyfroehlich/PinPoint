import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { NullableStringFieldUpdateOperationsInputSchema } from './NullableStringFieldUpdateOperationsInputSchema';
import { IntFieldUpdateOperationsInputSchema } from './IntFieldUpdateOperationsInputSchema';
import { NullableJsonNullValueInputSchema } from './NullableJsonNullValueInputSchema';
import { InputJsonValueSchema } from './InputJsonValueSchema';
import { CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInputSchema } from './CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInputSchema';
import { LocationUpdateOneWithoutCollectionsNestedInputSchema } from './LocationUpdateOneWithoutCollectionsNestedInputSchema';

export const CollectionUpdateWithoutMachinesInputSchema: z.ZodType<Prisma.CollectionUpdateWithoutMachinesInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  isSmart: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  isManual: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  description: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  sortOrder: z.union([ z.number().int(),z.lazy(() => IntFieldUpdateOperationsInputSchema) ]).optional(),
  filterCriteria: z.union([ z.lazy(() => NullableJsonNullValueInputSchema),InputJsonValueSchema ]).optional(),
  type: z.lazy(() => CollectionTypeUpdateOneRequiredWithoutCollectionsNestedInputSchema).optional(),
  location: z.lazy(() => LocationUpdateOneWithoutCollectionsNestedInputSchema).optional()
}).strict();

export default CollectionUpdateWithoutMachinesInputSchema;
