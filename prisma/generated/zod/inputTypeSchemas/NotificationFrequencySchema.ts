import { z } from 'zod';

export const NotificationFrequencySchema = z.enum(['IMMEDIATE','DAILY','WEEKLY','DISABLED']);

export type NotificationFrequencyType = `${z.infer<typeof NotificationFrequencySchema>}`

export default NotificationFrequencySchema;
