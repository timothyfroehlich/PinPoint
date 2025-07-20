import { z } from "zod";
import { JsonValueSchema } from "../inputTypeSchemas/JsonValueSchema";
import type { JsonValueType } from "../inputTypeSchemas/JsonValueSchema";
import {
  CollectionTypeWithRelationsSchema,
  CollectionTypePartialWithRelationsSchema,
  CollectionTypeOptionalDefaultsWithRelationsSchema,
} from "./CollectionTypeSchema";
import type {
  CollectionTypeWithRelations,
  CollectionTypePartialWithRelations,
  CollectionTypeOptionalDefaultsWithRelations,
} from "./CollectionTypeSchema";
import {
  LocationWithRelationsSchema,
  LocationPartialWithRelationsSchema,
  LocationOptionalDefaultsWithRelationsSchema,
} from "./LocationSchema";
import type {
  LocationWithRelations,
  LocationPartialWithRelations,
  LocationOptionalDefaultsWithRelations,
} from "./LocationSchema";
import {
  MachineWithRelationsSchema,
  MachinePartialWithRelationsSchema,
  MachineOptionalDefaultsWithRelationsSchema,
} from "./MachineSchema";
import type {
  MachineWithRelations,
  MachinePartialWithRelations,
  MachineOptionalDefaultsWithRelations,
} from "./MachineSchema";

/////////////////////////////////////////
// COLLECTION SCHEMA
/////////////////////////////////////////

export const CollectionSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  typeId: z.string(),
  locationId: z.string().nullable(),
  isSmart: z.boolean(),
  isManual: z.boolean(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  filterCriteria: JsonValueSchema.nullable(),
});

export type Collection = z.infer<typeof CollectionSchema>;

/////////////////////////////////////////
// COLLECTION PARTIAL SCHEMA
/////////////////////////////////////////

export const CollectionPartialSchema = CollectionSchema.partial();

export type CollectionPartial = z.infer<typeof CollectionPartialSchema>;

/////////////////////////////////////////
// COLLECTION OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const CollectionOptionalDefaultsSchema = CollectionSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    isSmart: z.boolean().optional(),
    isManual: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  }),
);

export type CollectionOptionalDefaults = z.infer<
  typeof CollectionOptionalDefaultsSchema
>;

/////////////////////////////////////////
// COLLECTION RELATION SCHEMA
/////////////////////////////////////////

export type CollectionRelations = {
  type: CollectionTypeWithRelations;
  location?: LocationWithRelations | null;
  machines: MachineWithRelations[];
};

export type CollectionWithRelations = Omit<
  z.infer<typeof CollectionSchema>,
  "filterCriteria"
> & {
  filterCriteria?: JsonValueType | null;
} & CollectionRelations;

export const CollectionWithRelationsSchema: z.ZodType<CollectionWithRelations> =
  CollectionSchema.merge(
    z.object({
      type: z.lazy(() => CollectionTypeWithRelationsSchema),
      location: z.lazy(() => LocationWithRelationsSchema).nullable(),
      machines: z.lazy(() => MachineWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// COLLECTION OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type CollectionOptionalDefaultsRelations = {
  type: CollectionTypeOptionalDefaultsWithRelations;
  location?: LocationOptionalDefaultsWithRelations | null;
  machines: MachineOptionalDefaultsWithRelations[];
};

export type CollectionOptionalDefaultsWithRelations = Omit<
  z.infer<typeof CollectionOptionalDefaultsSchema>,
  "filterCriteria"
> & {
  filterCriteria?: JsonValueType | null;
} & CollectionOptionalDefaultsRelations;

export const CollectionOptionalDefaultsWithRelationsSchema: z.ZodType<CollectionOptionalDefaultsWithRelations> =
  CollectionOptionalDefaultsSchema.merge(
    z.object({
      type: z.lazy(() => CollectionTypeOptionalDefaultsWithRelationsSchema),
      location: z
        .lazy(() => LocationOptionalDefaultsWithRelationsSchema)
        .nullable(),
      machines: z
        .lazy(() => MachineOptionalDefaultsWithRelationsSchema)
        .array(),
    }),
  );

/////////////////////////////////////////
// COLLECTION PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type CollectionPartialRelations = {
  type?: CollectionTypePartialWithRelations;
  location?: LocationPartialWithRelations | null;
  machines?: MachinePartialWithRelations[];
};

export type CollectionPartialWithRelations = Omit<
  z.infer<typeof CollectionPartialSchema>,
  "filterCriteria"
> & {
  filterCriteria?: JsonValueType | null;
} & CollectionPartialRelations;

export const CollectionPartialWithRelationsSchema: z.ZodType<CollectionPartialWithRelations> =
  CollectionPartialSchema.merge(
    z.object({
      type: z.lazy(() => CollectionTypePartialWithRelationsSchema),
      location: z.lazy(() => LocationPartialWithRelationsSchema).nullable(),
      machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
    }),
  ).partial();

export type CollectionOptionalDefaultsWithPartialRelations = Omit<
  z.infer<typeof CollectionOptionalDefaultsSchema>,
  "filterCriteria"
> & {
  filterCriteria?: JsonValueType | null;
} & CollectionPartialRelations;

export const CollectionOptionalDefaultsWithPartialRelationsSchema: z.ZodType<CollectionOptionalDefaultsWithPartialRelations> =
  CollectionOptionalDefaultsSchema.merge(
    z
      .object({
        type: z.lazy(() => CollectionTypePartialWithRelationsSchema),
        location: z.lazy(() => LocationPartialWithRelationsSchema).nullable(),
        machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export type CollectionWithPartialRelations = Omit<
  z.infer<typeof CollectionSchema>,
  "filterCriteria"
> & {
  filterCriteria?: JsonValueType | null;
} & CollectionPartialRelations;

export const CollectionWithPartialRelationsSchema: z.ZodType<CollectionWithPartialRelations> =
  CollectionSchema.merge(
    z
      .object({
        type: z.lazy(() => CollectionTypePartialWithRelationsSchema),
        location: z.lazy(() => LocationPartialWithRelationsSchema).nullable(),
        machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export default CollectionSchema;
