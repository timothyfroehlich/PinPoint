import type { Prisma } from "@prisma/client";

import { z } from "zod";
import { StringFieldUpdateOperationsInputSchema } from "./StringFieldUpdateOperationsInputSchema";
import { NullableStringFieldUpdateOperationsInputSchema } from "./NullableStringFieldUpdateOperationsInputSchema";
import { NullableFloatFieldUpdateOperationsInputSchema } from "./NullableFloatFieldUpdateOperationsInputSchema";
import { NullableIntFieldUpdateOperationsInputSchema } from "./NullableIntFieldUpdateOperationsInputSchema";
import { NullableDateTimeFieldUpdateOperationsInputSchema } from "./NullableDateTimeFieldUpdateOperationsInputSchema";
import { BoolFieldUpdateOperationsInputSchema } from "./BoolFieldUpdateOperationsInputSchema";
import { OrganizationUpdateOneRequiredWithoutLocationsNestedInputSchema } from "./OrganizationUpdateOneRequiredWithoutLocationsNestedInputSchema";
import { MachineUpdateManyWithoutLocationNestedInputSchema } from "./MachineUpdateManyWithoutLocationNestedInputSchema";
import { CollectionUpdateManyWithoutLocationNestedInputSchema } from "./CollectionUpdateManyWithoutLocationNestedInputSchema";

export const LocationUpdateInputSchema: z.ZodType<Prisma.LocationUpdateInput> =
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
      street: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      city: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      state: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      zip: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      phone: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      website: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      latitude: z
        .union([
          z.number(),
          z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      longitude: z
        .union([
          z.number(),
          z.lazy(() => NullableFloatFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      description: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      pinballMapId: z
        .union([
          z.number().int(),
          z.lazy(() => NullableIntFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      regionId: z
        .union([
          z.string(),
          z.lazy(() => NullableStringFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      lastSyncAt: z
        .union([
          z.coerce.date(),
          z.lazy(() => NullableDateTimeFieldUpdateOperationsInputSchema),
        ])
        .optional()
        .nullable(),
      syncEnabled: z
        .union([
          z.boolean(),
          z.lazy(() => BoolFieldUpdateOperationsInputSchema),
        ])
        .optional(),
      organization: z
        .lazy(
          () => OrganizationUpdateOneRequiredWithoutLocationsNestedInputSchema,
        )
        .optional(),
      machines: z
        .lazy(() => MachineUpdateManyWithoutLocationNestedInputSchema)
        .optional(),
      collections: z
        .lazy(() => CollectionUpdateManyWithoutLocationNestedInputSchema)
        .optional(),
    })
    .strict() as z.ZodType<Prisma.LocationUpdateInput>;

export default LocationUpdateInputSchema;
