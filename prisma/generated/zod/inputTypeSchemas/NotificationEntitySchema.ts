import { z } from 'zod';

export const NotificationEntitySchema = z.enum(['ISSUE','MACHINE','COMMENT','ORGANIZATION']);

export type NotificationEntityType = `${z.infer<typeof NotificationEntitySchema>}`

export default NotificationEntitySchema;
