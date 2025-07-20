import { z } from 'zod';

export const MachineScalarFieldEnumSchema = z.enum(['id','name','organizationId','locationId','modelId','ownerId','ownerNotificationsEnabled','notifyOnNewIssues','notifyOnStatusChanges','notifyOnComments','qrCodeId','qrCodeUrl','qrCodeGeneratedAt']);

export default MachineScalarFieldEnumSchema;
