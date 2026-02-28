import { z } from "zod";

export const OPDB_ID_REGEX =
  /^G[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)?)?$/u;

const opdbYearValueSchema = z.union([
  z.number().int(),
  z.string(),
  z
    .object({
      value: z.union([z.number().int(), z.string()]).optional(),
      year: z.union([z.number().int(), z.string()]).optional(),
    })
    .passthrough(),
]);

export const opdbIdSchema = z
  .string()
  .trim()
  .regex(OPDB_ID_REGEX, "Invalid OPDB model ID");

export const opdbSearchQuerySchema = z
  .string()
  .trim()
  .min(2, "Search query must be at least 2 characters")
  .max(100, "Search query is too long");

export interface OpdbSearchResult {
  id: string;
  title: string;
  manufacturer: string | null;
  year: number | null;
  label: string;
}

export interface OpdbMachineDetails {
  id: string;
  title: string;
  manufacturer: string | null;
  year: number | null;
  imageUrl: string | null;
  machineType: string | null;
}

export interface OpdbModelSelection {
  id: string;
  title: string;
  manufacturer: string | null;
  year: number | null;
}

export const opdbSearchResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  manufacturer: z.string().nullable(),
  year: z.number().int().nullable(),
  label: z.string(),
});

export const opdbSearchResponseSchema = z.object({
  results: z.array(opdbSearchResultSchema),
});

export const opdbModelSelectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  manufacturer: z.string().nullable(),
  year: z.number().int().nullable(),
});

export const opdbSearchEntrySchema = z
  .object({
    id: z.string(),
    text: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    manufacturer: z.string().nullable().optional(),
    year: opdbYearValueSchema.nullable().optional(),
  })
  .passthrough();

export const opdbSearchApiResponseSchema = z.union([
  z.array(opdbSearchEntrySchema),
  z
    .object({
      results: z.array(opdbSearchEntrySchema),
    })
    .passthrough(),
]);

export const opdbMachineDetailsApiSchema = z
  .object({
    id: z.string(),
    text: z.string().optional(),
    title: z.string().optional(),
    name: z.string().optional(),
    manufacturer: z.string().nullable().optional(),
    year: opdbYearValueSchema.nullable().optional(),
    type: z.string().nullable().optional(),
    machine_type: z.string().nullable().optional(),
    playfield_image: z.string().nullable().optional(),
    backglass_image: z.string().nullable().optional(),
    cabinet_image: z.string().nullable().optional(),
    images: z.array(z.string()).optional(),
  })
  .passthrough();

export type OpdbSearchApiEntry = z.infer<typeof opdbSearchEntrySchema>;
export type OpdbSearchApiResponse = z.infer<typeof opdbSearchApiResponseSchema>;
export type OpdbMachineDetailsApi = z.infer<typeof opdbMachineDetailsApiSchema>;
