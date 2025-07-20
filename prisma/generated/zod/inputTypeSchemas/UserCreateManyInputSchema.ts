import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { NotificationFrequencySchema } from "./NotificationFrequencySchema";

export const UserCreateManyInputSchema: z.ZodType<Prisma.UserCreateManyInput> =
  z
    .object({
      id: z.string().cuid().optional(),
      name: z.string().optional().nullable(),
      email: z.string().optional().nullable(),
      emailVerified: z.coerce.date().optional().nullable(),
      image: z.string().optional().nullable(),
      createdAt: z.coerce.date().optional(),
      updatedAt: z.coerce.date().optional(),
      bio: z.string().optional().nullable(),
      profilePicture: z.string().optional().nullable(),
      emailNotificationsEnabled: z.boolean().optional(),
      pushNotificationsEnabled: z.boolean().optional(),
      notificationFrequency: z
        .lazy(() => NotificationFrequencySchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UserCreateManyInput>;

export default UserCreateManyInputSchema;
