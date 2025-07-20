import { z } from 'zod';

export const PinballMapConfigScalarFieldEnumSchema = z.enum(['id','organizationId','apiEnabled','apiKey','autoSyncEnabled','syncIntervalHours','lastGlobalSync','createMissingModels','updateExistingData']);

export default PinballMapConfigScalarFieldEnumSchema;
