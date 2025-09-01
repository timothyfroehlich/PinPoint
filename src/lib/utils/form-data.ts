/**
 * Type-safe FormData utilities for Server Actions
 * Eliminates TS4111 bracket notation errors and provides runtime safety
 */

import { z } from "zod";

/**
 * Extract a single field from FormData with type safety
 */
export function extractFormField<T>(
  formData: FormData,
  fieldName: string,
  schema: z.ZodSchema<T>,
): T {
  const value = formData.get(fieldName);

  if (value === null) {
    throw new Error(`Missing required field: ${fieldName}`);
  }

  try {
    return schema.parse(value);
  } catch (error) {
    throw new Error(
      `Invalid ${fieldName}: ${error instanceof z.ZodError ? error.message : "Validation failed"}`,
    );
  }
}

/**
 * Extract an optional field from FormData with type safety
 */
export function extractOptionalFormField<T>(
  formData: FormData,
  fieldName: string,
  schema: z.ZodSchema<T>,
): T | null {
  const value = formData.get(fieldName);

  if (value === null) {
    return null;
  }

  try {
    return schema.parse(value);
  } catch (error) {
    throw new Error(
      `Invalid ${fieldName}: ${error instanceof z.ZodError ? error.message : "Validation failed"}`,
    );
  }
}

/**
 * Extract multiple fields from FormData using a schema
 */
export function extractFormFields<T extends Record<string, unknown>>(
  formData: FormData,
  schema: z.ZodSchema<T>,
): T {
  // Convert FormData to plain object
  const data: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};

  for (const [key, value] of formData.entries()) {
    if (key in data) {
      // Handle multiple values for same field name
      const existing = data[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        data[key] = [existing!, value];
      }
    } else {
      data[key] = value;
    }
  }

  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = error.issues
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new Error(`Form validation failed: ${fieldErrors}`);
    }
    throw new Error("Form validation failed");
  }
}

/**
 * Common field type schemas for reuse
 */
export const formFieldTypes = {
  string: z.string().trim(),
  nonEmptyString: z.string().trim().min(1, "Field cannot be empty"),
  email: z.string().email("Invalid email address").trim().toLowerCase(),
  uuid: z.string().uuid("Invalid ID format"),
  boolean: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .transform((val) => val === true || val === "true"),
  number: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === "string" ? parseFloat(val) : val;
    if (isNaN(num)) throw new Error("Invalid number");
    return num;
  }),
  integer: z.union([z.string(), z.number()]).transform((val) => {
    const num = typeof val === "string" ? parseInt(val, 10) : val;
    if (isNaN(num)) throw new Error("Invalid integer");
    return num;
  }),
} as const;

/**
 * Helper for extracting common field types without defining schema inline
 */
export const extractField = {
  string: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.string),
  nonEmptyString: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.nonEmptyString),
  email: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.email),
  uuid: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.uuid),
  boolean: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.boolean),
  number: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.number),
  integer: (formData: FormData, name: string) =>
    extractFormField(formData, name, formFieldTypes.integer),
} as const;

/**
 * Helper for extracting optional common field types
 */
export const extractOptionalField = {
  string: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.string),
  nonEmptyString: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.nonEmptyString),
  email: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.email),
  uuid: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.uuid),
  boolean: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.boolean),
  number: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.number),
  integer: (formData: FormData, name: string) =>
    extractOptionalFormField(formData, name, formFieldTypes.integer),
} as const;
