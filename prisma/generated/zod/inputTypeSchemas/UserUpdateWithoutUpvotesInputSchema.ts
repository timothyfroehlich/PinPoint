import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { NullableDateTimeFieldUpdateOperationsInputSchema } from "./NullableDateTimeFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { NotificationFrequencySchema } from "./NotificationFrequencySchema";
import { EnumNotificationFrequencyFieldUpdateOperationsInputSchema } from "./EnumNotificationFrequencyFieldUpdateOperationsInputSchema";
import { AccountUpdateManyWithoutUserNestedInputSchema } from "./AccountUpdateManyWithoutUserNestedInputSchema";
import { SessionUpdateManyWithoutUserNestedInputSchema } from "./SessionUpdateManyWithoutUserNestedInputSchema";
import { MembershipUpdateManyWithoutUserNestedInputSchema } from "./MembershipUpdateManyWithoutUserNestedInputSchema";
import { MachineUpdateManyWithoutOwnerNestedInputSchema } from "./MachineUpdateManyWithoutOwnerNestedInputSchema";
import { IssueUpdateManyWithoutCreatedByNestedInputSchema } from "./IssueUpdateManyWithoutCreatedByNestedInputSchema";
import { IssueUpdateManyWithoutAssignedToNestedInputSchema } from "./IssueUpdateManyWithoutAssignedToNestedInputSchema";
import { CommentUpdateManyWithoutAuthorNestedInputSchema } from "./CommentUpdateManyWithoutAuthorNestedInputSchema";
import { CommentUpdateManyWithoutDeleterNestedInputSchema } from "./CommentUpdateManyWithoutDeleterNestedInputSchema";
import { IssueHistoryUpdateManyWithoutActorNestedInputSchema } from "./IssueHistoryUpdateManyWithoutActorNestedInputSchema";
import { NotificationUpdateManyWithoutUserNestedInputSchema } from "./NotificationUpdateManyWithoutUserNestedInputSchema";

export const UserUpdateWithoutUpvotesInputSchema: z.ZodType<Prisma.UserUpdateWithoutUpvotesInput> =
  z
    .object({
      id: z
        .union([
          z.string().cuid(),
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      name: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      email: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      emailVerified: z
        .union([
          z.coerce.date(),
          z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      image: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      createdAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      updatedAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => DateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      bio: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      profilePicture: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      emailNotificationsEnabled: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      pushNotificationsEnabled: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      notificationFrequency: z
        .union([
          z.lazy(() => NotificationFrequencySchema),
          z.lazy(
            () => EnumNotificationFrequencyFieldUpdateOperationsInputSchema,
          ),
        ])
        .optional(),
      accounts: z
        .lazy(() => AccountUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      sessions: z
        .lazy(() => SessionUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      memberships: z
        .lazy(() => MembershipUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      ownedMachines: z
        .lazy(() => MachineUpdateManyWithoutOwnerNestedInputSchema)
        .optional(),
      issuesCreated: z
        .lazy(() => IssueUpdateManyWithoutCreatedByNestedInputSchema)
        .optional(),
      issuesAssigned: z
        .lazy(() => IssueUpdateManyWithoutAssignedToNestedInputSchema)
        .optional(),
      comments: z
        .lazy(() => CommentUpdateManyWithoutAuthorNestedInputSchema)
        .optional(),
      deletedComments: z
        .lazy(() => CommentUpdateManyWithoutDeleterNestedInputSchema)
        .optional(),
      activityHistory: z
        .lazy(() => IssueHistoryUpdateManyWithoutActorNestedInputSchema)
        .optional(),
      notifications: z
        .lazy(() => NotificationUpdateManyWithoutUserNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UserUpdateWithoutUpvotesInput>;

export default UserUpdateWithoutUpvotesInputSchema;
