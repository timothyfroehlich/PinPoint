import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { NullableDateTimeFieldUpdateOperationsInputSchema } from "./NullableDateTimeFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { NotificationFrequencySchema } from "./NotificationFrequencySchema";
import { EnumNotificationFrequencyFieldUpdateOperationsInputSchema } from "./EnumNotificationFrequencyFieldUpdateOperationsInputSchema";
import { AccountUncheckedUpdateManyWithoutUserNestedInputSchema } from "./AccountUncheckedUpdateManyWithoutUserNestedInputSchema";
import { SessionUncheckedUpdateManyWithoutUserNestedInputSchema } from "./SessionUncheckedUpdateManyWithoutUserNestedInputSchema";
import { MembershipUncheckedUpdateManyWithoutUserNestedInputSchema } from "./MembershipUncheckedUpdateManyWithoutUserNestedInputSchema";
import { MachineUncheckedUpdateManyWithoutOwnerNestedInputSchema } from "./MachineUncheckedUpdateManyWithoutOwnerNestedInputSchema";
import { IssueUncheckedUpdateManyWithoutAssignedToNestedInputSchema } from "./IssueUncheckedUpdateManyWithoutAssignedToNestedInputSchema";
import { CommentUncheckedUpdateManyWithoutAuthorNestedInputSchema } from "./CommentUncheckedUpdateManyWithoutAuthorNestedInputSchema";
import { CommentUncheckedUpdateManyWithoutDeleterNestedInputSchema } from "./CommentUncheckedUpdateManyWithoutDeleterNestedInputSchema";
import { UpvoteUncheckedUpdateManyWithoutUserNestedInputSchema } from "./UpvoteUncheckedUpdateManyWithoutUserNestedInputSchema";
import { IssueHistoryUncheckedUpdateManyWithoutActorNestedInputSchema } from "./IssueHistoryUncheckedUpdateManyWithoutActorNestedInputSchema";
import { NotificationUncheckedUpdateManyWithoutUserNestedInputSchema } from "./NotificationUncheckedUpdateManyWithoutUserNestedInputSchema";

export const UserUncheckedUpdateWithoutIssuesCreatedInputSchema: z.ZodType<Prisma.UserUncheckedUpdateWithoutIssuesCreatedInput> =
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
        .lazy(() => AccountUncheckedUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      sessions: z
        .lazy(() => SessionUncheckedUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      memberships: z
        .lazy(() => MembershipUncheckedUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      ownedMachines: z
        .lazy(() => MachineUncheckedUpdateManyWithoutOwnerNestedInputSchema)
        .optional(),
      issuesAssigned: z
        .lazy(() => IssueUncheckedUpdateManyWithoutAssignedToNestedInputSchema)
        .optional(),
      comments: z
        .lazy(() => CommentUncheckedUpdateManyWithoutAuthorNestedInputSchema)
        .optional(),
      deletedComments: z
        .lazy(() => CommentUncheckedUpdateManyWithoutDeleterNestedInputSchema)
        .optional(),
      upvotes: z
        .lazy(() => UpvoteUncheckedUpdateManyWithoutUserNestedInputSchema)
        .optional(),
      activityHistory: z
        .lazy(
          () => IssueHistoryUncheckedUpdateManyWithoutActorNestedInputSchema,
        )
        .optional(),
      notifications: z
        .lazy(() => NotificationUncheckedUpdateManyWithoutUserNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.UserUncheckedUpdateWithoutIssuesCreatedInput>;

export default UserUncheckedUpdateWithoutIssuesCreatedInputSchema;
