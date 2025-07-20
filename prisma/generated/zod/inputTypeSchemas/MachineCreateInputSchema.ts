import type { Prisma } from '@prisma/client';

import { z } from 'zod';
import { OrganizationCreateNestedOneWithoutMachinesInputSchema } from './OrganizationCreateNestedOneWithoutMachinesInputSchema';
import { LocationCreateNestedOneWithoutMachinesInputSchema } from './LocationCreateNestedOneWithoutMachinesInputSchema';
import { ModelCreateNestedOneWithoutMachinesInputSchema } from './ModelCreateNestedOneWithoutMachinesInputSchema';
import { UserCreateNestedOneWithoutOwnedMachinesInputSchema } from './UserCreateNestedOneWithoutOwnedMachinesInputSchema';
import { IssueCreateNestedManyWithoutMachineInputSchema } from './IssueCreateNestedManyWithoutMachineInputSchema';
import { CollectionCreateNestedManyWithoutMachinesInputSchema } from './CollectionCreateNestedManyWithoutMachinesInputSchema';

export const MachineCreateInputSchema: z.ZodType<Prisma.MachineCreateInput> = z.object({
  id: z.string().cuid().optional(),
  name: z.string(),
  ownerNotificationsEnabled: z.boolean().optional(),
  notifyOnNewIssues: z.boolean().optional(),
  notifyOnStatusChanges: z.boolean().optional(),
  notifyOnComments: z.boolean().optional(),
  qrCodeId: z.string().cuid().optional(),
  qrCodeUrl: z.string().optional().nullable(),
  qrCodeGeneratedAt: z.coerce.date().optional().nullable(),
  organization: z.lazy(() => OrganizationCreateNestedOneWithoutMachinesInputSchema),
  location: z.lazy(() => LocationCreateNestedOneWithoutMachinesInputSchema),
  model: z.lazy(() => ModelCreateNestedOneWithoutMachinesInputSchema),
  owner: z.lazy(() => UserCreateNestedOneWithoutOwnedMachinesInputSchema).optional(),
  issues: z.lazy(() => IssueCreateNestedManyWithoutMachineInputSchema).optional(),
  collections: z.lazy(() => CollectionCreateNestedManyWithoutMachinesInputSchema).optional()
}).strict();

export default MachineCreateInputSchema;
