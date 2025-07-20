import { z } from "zod";
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
// MODEL SCHEMA
/////////////////////////////////////////

export const ModelSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  manufacturer: z.string().nullable(),
  year: z.number().int().nullable(),
  ipdbId: z.string().nullable(),
  opdbId: z.string().nullable(),
  machineType: z.string().nullable(),
  machineDisplay: z.string().nullable(),
  isActive: z.boolean(),
  ipdbLink: z.string().nullable(),
  opdbImgUrl: z.string().nullable(),
  kineticistUrl: z.string().nullable(),
  isCustom: z.boolean(),
});

export type Model = z.infer<typeof ModelSchema>;

/////////////////////////////////////////
// MODEL PARTIAL SCHEMA
/////////////////////////////////////////

export const ModelPartialSchema = ModelSchema.partial();

export type ModelPartial = z.infer<typeof ModelPartialSchema>;

/////////////////////////////////////////
// MODEL OPTIONAL DEFAULTS SCHEMA
/////////////////////////////////////////

export const ModelOptionalDefaultsSchema = ModelSchema.merge(
  z.object({
    id: z.string().cuid().optional(),
    isActive: z.boolean().optional(),
    isCustom: z.boolean().optional(),
  }),
);

export type ModelOptionalDefaults = z.infer<typeof ModelOptionalDefaultsSchema>;

/////////////////////////////////////////
// MODEL RELATION SCHEMA
/////////////////////////////////////////

export type ModelRelations = {
  machines: MachineWithRelations[];
};

export type ModelWithRelations = z.infer<typeof ModelSchema> & ModelRelations;

export const ModelWithRelationsSchema: z.ZodType<ModelWithRelations> =
  ModelSchema.merge(
    z.object({
      machines: z.lazy(() => MachineWithRelationsSchema).array(),
    }),
  );

/////////////////////////////////////////
// MODEL OPTIONAL DEFAULTS RELATION SCHEMA
/////////////////////////////////////////

export type ModelOptionalDefaultsRelations = {
  machines: MachineOptionalDefaultsWithRelations[];
};

export type ModelOptionalDefaultsWithRelations = z.infer<
  typeof ModelOptionalDefaultsSchema
> &
  ModelOptionalDefaultsRelations;

export const ModelOptionalDefaultsWithRelationsSchema: z.ZodType<ModelOptionalDefaultsWithRelations> =
  ModelOptionalDefaultsSchema.merge(
    z.object({
      machines: z
        .lazy(() => MachineOptionalDefaultsWithRelationsSchema)
        .array(),
    }),
  );

/////////////////////////////////////////
// MODEL PARTIAL RELATION SCHEMA
/////////////////////////////////////////

export type ModelPartialRelations = {
  machines?: MachinePartialWithRelations[];
};

export type ModelPartialWithRelations = z.infer<typeof ModelPartialSchema> &
  ModelPartialRelations;

export const ModelPartialWithRelationsSchema: z.ZodType<ModelPartialWithRelations> =
  ModelPartialSchema.merge(
    z.object({
      machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
    }),
  ).partial();

export type ModelOptionalDefaultsWithPartialRelations = z.infer<
  typeof ModelOptionalDefaultsSchema
> &
  ModelPartialRelations;

export const ModelOptionalDefaultsWithPartialRelationsSchema: z.ZodType<ModelOptionalDefaultsWithPartialRelations> =
  ModelOptionalDefaultsSchema.merge(
    z
      .object({
        machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export type ModelWithPartialRelations = z.infer<typeof ModelSchema> &
  ModelPartialRelations;

export const ModelWithPartialRelationsSchema: z.ZodType<ModelWithPartialRelations> =
  ModelSchema.merge(
    z
      .object({
        machines: z.lazy(() => MachinePartialWithRelationsSchema).array(),
      })
      .partial(),
  );

export default ModelSchema;
