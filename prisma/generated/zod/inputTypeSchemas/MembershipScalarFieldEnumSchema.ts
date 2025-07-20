import { z } from 'zod';

export const MembershipScalarFieldEnumSchema = z.enum(['id','userId','organizationId','roleId']);

export default MembershipScalarFieldEnumSchema;
