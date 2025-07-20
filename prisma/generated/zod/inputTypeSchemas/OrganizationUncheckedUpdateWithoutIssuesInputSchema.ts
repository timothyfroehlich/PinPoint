import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { DateTimeFieldUpdateOperationsInputSchema } from "./DateTimeFieldUpdateOperationsInputSchema";
import { MembershipUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./MembershipUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { LocationUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./LocationUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { RoleUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./RoleUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { MachineUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./MachineUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { PriorityUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./PriorityUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { AttachmentUncheckedUpdateManyWithoutOrganizationNestedInputSchema } from "./AttachmentUncheckedUpdateManyWithoutOrganizationNestedInputSchema";
import { PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInputSchema } from "./PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInputSchema";

export const OrganizationUncheckedUpdateWithoutIssuesInputSchema: z.ZodType<Prisma.OrganizationUncheckedUpdateWithoutIssuesInput> =
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
          z.lazy(() => StringFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      subdomain: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      logoUrl: z
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
      memberships: z
        .lazy(
          () =>
            MembershipUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      locations: z
        .lazy(
          () => LocationUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      roles: z
        .lazy(() => RoleUncheckedUpdateManyWithoutOrganizationNestedInputSchema)
        .optional(),
      machines: z
        .lazy(
          () => MachineUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      priorities: z
        .lazy(
          () => PriorityUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      issueStatuses: z
        .lazy(
          () =>
            IssueStatusUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      collectionTypes: z
        .lazy(
          () =>
            CollectionTypeUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      issueHistory: z
        .lazy(
          () =>
            IssueHistoryUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      attachments: z
        .lazy(
          () =>
            AttachmentUncheckedUpdateManyWithoutOrganizationNestedInputSchema,
        )
        .optional(),
      pinballMapConfig: z
        .lazy(
          () =>
            PinballMapConfigUncheckedUpdateOneWithoutOrganizationNestedInputSchema,
        )
        .optional(),
    })
    .strict() as z.ZodType<Prisma.OrganizationUncheckedUpdateWithoutIssuesInput>;

export default OrganizationUncheckedUpdateWithoutIssuesInputSchema;
