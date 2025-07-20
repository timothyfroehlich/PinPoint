import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { StringFieldUpdateOperationsInputSchema } from './StringFieldUpdateOperationsInputSchema';
import { BoolFieldUpdateOperationsInputSchema } from './BoolFieldUpdateOperationsInputSchema';
import { NullableStringFieldUpdateOperationsInputSchema } from './NullableStringFieldUpdateOperationsInputSchema';
import { NullableDateTimeFieldUpdateOperationsInputSchema } from './NullableDateTimeFieldUpdateOperationsInputSchema';
import { OrganizationUpdateOneRequiredWithoutMachinesNestedInputSchema } from './OrganizationUpdateOneRequiredWithoutMachinesNestedInputSchema';
import { LocationUpdateOneRequiredWithoutMachinesNestedInputSchema } from './LocationUpdateOneRequiredWithoutMachinesNestedInputSchema';
import { UserUpdateOneWithoutOwnedMachinesNestedInputSchema } from './UserUpdateOneWithoutOwnedMachinesNestedInputSchema';
import { IssueUpdateManyWithoutMachineNestedInputSchema } from './IssueUpdateManyWithoutMachineNestedInputSchema';
import { CollectionUpdateManyWithoutMachinesNestedInputSchema } from './CollectionUpdateManyWithoutMachinesNestedInputSchema';

export const MachineUpdateWithoutModelInputSchema: z.ZodType<Prisma.MachineUpdateWithoutModelInput> = z.object({
  id: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  name: z.union([ z.string(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  ownerNotificationsEnabled: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  notifyOnNewIssues: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  notifyOnStatusChanges: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  notifyOnComments: z.union([ z.boolean(),z.lazy(() => BoolFieldUpdateOperationsInputSchema) ]).optional(),
  qrCodeId: z.union([ z.string().cuid(),z.lazy(() => StringFieldUpdateOperationsInputSchema) ]).optional(),
  qrCodeUrl: z.union([ z.string(),z.lazy(() => NullableStringFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  qrCodeGeneratedAt: z.union([ z.coerce.date(),z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema) ]).optional().nullable(),
  organization: z.lazy(() => OrganizationUpdateOneRequiredWithoutMachinesNestedInputSchema).optional(),
  location: z.lazy(() => LocationUpdateOneRequiredWithoutMachinesNestedInputSchema).optional(),
  owner: z.lazy(() => UserUpdateOneWithoutOwnedMachinesNestedInputSchema).optional(),
  issues: z.lazy(() => IssueUpdateManyWithoutMachineNestedInputSchema).optional(),
  collections: z.lazy(() => CollectionUpdateManyWithoutMachinesNestedInputSchema).optional()
}).strict();

export default MachineUpdateWithoutModelInputSchema;
