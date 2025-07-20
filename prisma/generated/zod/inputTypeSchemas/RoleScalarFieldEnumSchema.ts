import { z } from 'zod';

export const RoleScalarFieldEnumSchema = z.enum(['id','name','organizationId','isDefault']);

export default RoleScalarFieldEnumSchema;
