import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { NullableStringFieldUpdateOperationsInputSchema } from './NullableStringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { NullableDateTimeFieldUpdateOperationsInputSchema } from './NullableDateTimeFieldUpdateOperationsInputSchema';
import { IssueUncheckedUpdateManyWithoutMachineNestedInputSchema } from './IssueUncheckedUpdateManyWithoutMachineNestedInputSchema';
import { CollectionUncheckedUpdateManyWithoutMachinesNestedInputSchema } from './CollectionUncheckedUpdateManyWithoutMachinesNestedInputSchema';

export const MachineUncheckedUpdateWithoutLocationInputSchema: z.ZodType<Prisma.MachineUncheckedUpdateWithoutLocationInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  organizationId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  modelId: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  ownerId: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  ownerNotificationsEnabled: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  notifyOnNewIssues: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  notifyOnStatusChanges: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  notifyOnComments: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  qrCodeId: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  qrCodeUrl: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  qrCodeGeneratedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  issues: z.lazy(() => IssueUncheckedUpdateManyWithoutMachineNestedInputSchema).optional(),
  collections: z.lazy(() => CollectionUncheckedUpdateManyWithoutMachinesNestedInputSchema).optional()
}).strict();

export default MachineUncheckedUpdateWithoutLocationInputSchema;
