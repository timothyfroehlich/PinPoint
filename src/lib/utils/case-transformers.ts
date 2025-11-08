/**
 * Case transformation utilities for converting between snake_case and camelCase.
 *
 * This module provides comprehensive utilities for transforming strings and objects
 * between different casing conventions, particularly useful for converting between
 * database conventions (snake_case) and TypeScript conventions (camelCase).
 *
 * SECURITY NOTE: This file contains legitimate dynamic property access patterns
 * for object key transformation. The ESLint security plugin flags these as potential
 * object injection vulnerabilities, but they are safe because:
 * 1. All keys are computed through controlled transformation functions
 * 2. Objects being transformed are validated input (not arbitrary user data)
 * 3. Property names are transformed predictably (snake_case ↔ camelCase)
 * 4. No user input directly controls property access patterns
 *
 * TYPE ASSERTION SAFETY (for `as` casts using these transformers):
 *
 * These transformers are used throughout the codebase with type assertions like:
 *   `transformKeysToCamelCase(dbData) as IssueResponse`
 *   `transformKeysToSnakeCase(appData) as typeof issues.$inferInsert`
 *
 * WHY THESE ASSERTIONS ARE GENERALLY SAFE:
 * 1. Transformers are PURELY SYNTACTIC - they only rename keys, never modify values
 * 2. Data is typically pre-validated via Zod schemas or TypeScript construction
 * 3. Transformers are deterministic and extensively tested
 * 4. TypeScript catches type errors at data construction time (before transformation)
 *
 * WHEN ASSERTIONS ARE RISKY:
 * 1. Schema changes: Adding new required fields without defaults → runtime errors
 * 2. Type mismatches: Wrong response type → incorrect field names in client code
 * 3. Missing fields: Incomplete data construction → undefined values at runtime
 *
 * RECOMMENDED PRACTICES:
 * 1. For database inserts: Construct objects with explicit fields before transforming
 * 2. For API responses: Use dedicated transformer functions (see api-response-transformers.ts)
 * 3. For high-risk paths: Add inline safety comments explaining why assertion is safe
 * 4. Always have integration tests validating the transformation paths
 *
 * @example
 * ```typescript
 * // String transformations
 * toCamelCase('user_name') // 'userName'
 * toSnakeCase('userName') // 'user_name'
 *
 * // Object transformations
 * const dbUser = { user_id: 1, first_name: 'John', created_at: new Date() }
 * const appUser = transformKeysToCamelCase(dbUser)
 * // { userId: 1, firstName: 'John', createdAt: Date }
 *
 * // Type-level transformations
 * type DbUser = { user_id: number; first_name: string }
 * type AppUser = CamelCased<DbUser> // { userId: number; firstName: string }
 *
 * // Safe assertion pattern (recommended)
 * const issueData = {
 *   id: generateId(),
 *   title: validatedTitle,
 *   machineId: validatedMachineId,
 *   // ... all required fields explicitly provided
 * };
 * // SAFE: All fields constructed above, transformer only renames keys
 * await db.insert(issues).values(
 *   transformKeysToSnakeCase(issueData) as typeof issues.$inferInsert
 * );
 * ```
 */

/* eslint-disable security/detect-object-injection */

/**
 * Converts a snake_case string to camelCase.
 * Handles edge cases like already camelCase strings and mixed formats.
 *
 * @param str - The string to convert
 * @returns The camelCase version of the string
 *
 * @example
 * ```typescript
 * toCamelCase('user_name') // 'userName'
 * toCamelCase('user_name_id') // 'userNameId'
 * toCamelCase('userName') // 'userName' (already camelCase)
 * toCamelCase('id') // 'id' (single word)
 * ```
 */
export function toCamelCase(str: string): string {
  if (!str || typeof str !== "string") {
    return str;
  }

  // If already camelCase or no underscores, return as-is
  if (!str.includes("_")) {
    return str;
  }

  return str
    .toLowerCase()
    .replace(/^_+/, "") // Remove leading underscores
    .replace(/_+$/, "") // Remove trailing underscores
    .replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Converts a camelCase string to snake_case.
 * Handles edge cases like already snake_case strings and mixed formats.
 *
 * @param str - The string to convert
 * @returns The snake_case version of the string
 *
 * @example
 * ```typescript
 * toSnakeCase('userName') // 'user_name'
 * toSnakeCase('userNameId') // 'user_name_id'
 * toSnakeCase('user_name') // 'user_name' (already snake_case)
 * toSnakeCase('id') // 'id' (single word)
 * ```
 */
export function toSnakeCase(str: string): string {
  if (!str || typeof str !== "string") {
    return str;
  }

  // If already snake_case or no uppercase letters, return as-is
  if (!/[A-Z]/.exec(str)) {
    return str;
  }

  return (
    str
      // Handle acronym->word boundaries (XMLHttp -> XML_Http)
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      // Handle lowercase->uppercase boundaries (userID -> user_ID)
      .replace(/([a-z])([A-Z])/g, "$1_$2")
      .toLowerCase()
      .replace(/^_/, "")
  ); // Remove leading underscore if present
}

/**
 * Checks if a value is a plain object (not an instance of a class, built-in type, or other special object).
 * Used to guard against transforming non-plain objects like Map, Set, URL, Buffer, etc.
 *
 * @param obj - The value to check
 * @returns True if the value is a plain object
 */
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    return false;
  }

  // Check for built-in types that should not be transformed
  if (obj instanceof Date || obj instanceof RegExp || obj instanceof Error) {
    return false;
  }

  // Check for other common non-plain objects
  if (
    obj instanceof Map ||
    obj instanceof Set ||
    obj instanceof WeakMap ||
    obj instanceof WeakSet
  ) {
    return false;
  }

  // Check for Buffer (Node.js)
  if (typeof Buffer !== "undefined" && obj instanceof Buffer) {
    return false;
  }

  // Check for URL and other Web APIs
  if (typeof URL !== "undefined" && obj instanceof URL) {
    return false;
  }

  // Check if it's a plain object by looking at its prototype
  const proto = Object.getPrototypeOf(obj) as unknown;
  return proto === null || proto === Object.prototype;
}

/**
 * Recursively transforms all keys in an object from snake_case to camelCase.
 * Preserves non-plain objects like Date, maintains array structure, and handles nested objects.
 *
 * @param obj - The object to transform
 * @returns A new object with camelCase keys
 *
 * @example
 * ```typescript
 * const input = {
 *   user_id: 1,
 *   created_at: new Date(),
 *   user_profile: {
 *     first_name: 'John',
 *     last_name: 'Doe'
 *   },
 *   tags: [{ tag_name: 'admin' }]
 * }
 *
 * const output = transformKeysToCamelCase(input)
 * // {
 * //   userId: 1,
 * //   createdAt: Date,
 * //   userProfile: {
 * //     firstName: 'John',
 * //     lastName: 'Doe'
 * //   },
 * //   tags: [{ tagName: 'admin' }]
 * // }
 * ```
 */
export function transformKeysToCamelCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToCamelCase(item));
  }

  if (!isPlainObject(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const camelKey = toCamelCase(key);
    result[camelKey] = transformKeysToCamelCase(value);
  }

  return result;
}

/**
 * Recursively transforms all keys in an object from camelCase to snake_case.
 * Preserves non-plain objects like Date, maintains array structure, and handles nested objects.
 *
 * @param obj - The object to transform
 * @returns A new object with snake_case keys
 *
 * @example
 * ```typescript
 * const input = {
 *   userId: 1,
 *   createdAt: new Date(),
 *   userProfile: {
 *     firstName: 'John',
 *     lastName: 'Doe'
 *   }
 * }
 *
 * const output = transformKeysToSnakeCase(input)
 * // {
 * //   user_id: 1,
 * //   created_at: Date,
 * //   user_profile: {
 * //     first_name: 'John',
 * //     last_name: 'Doe'
 * //   }
 * // }
 * ```
 */
export function transformKeysToSnakeCase(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => transformKeysToSnakeCase(item));
  }

  if (!isPlainObject(obj)) {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    result[snakeKey] = transformKeysToSnakeCase(value);
  }

  return result;
}

// Type-level utilities for compile-time case transformations

/**
 * Converts a string literal type from snake_case to camelCase.
 *
 * @example
 * ```typescript
 * type Example = CamelCase<'user_name'> // 'userName'
 * type Example2 = CamelCase<'created_at'> // 'createdAt'
 * ```
 */
export type CamelCase<S extends string> =
  S extends `${infer P1}_${infer P2}${infer P3}`
    ? `${P1}${Uppercase<P2>}${CamelCase<P3>}`
    : S;

/**
 * Converts a string literal type from camelCase to snake_case.
 *
 * @example
 * ```typescript
 * type Example = SnakeCase<'userName'> // 'user_name'
 * type Example2 = SnakeCase<'createdAt'> // 'created_at'
 * ```
 */
export type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? `${T extends Capitalize<T> ? "_" : ""}${Lowercase<T>}${SnakeCase<U>}`
  : S;

/**
 * Recursively converts all keys in an object type from snake_case to camelCase.
 *
 * @example
 * ```typescript
 * type DbUser = {
 *   user_id: number;
 *   first_name: string;
 *   created_at: Date;
 * }
 *
 * type AppUser = CamelCased<DbUser>
 * // {
 * //   userId: number;
 * //   firstName: string;
 * //   createdAt: Date;
 * // }
 * ```
 */
export type CamelCased<T> = {
  [K in keyof T as CamelCase<string & K>]: T[K] extends object
    ? T[K] extends Date
      ? T[K]
      : CamelCased<T[K]>
    : T[K];
};

/**
 * Recursively converts all keys in an object type from camelCase to snake_case.
 *
 * @example
 * ```typescript
 * type AppUser = {
 *   userId: number;
 *   firstName: string;
 *   createdAt: Date;
 * }
 *
 * type DbUser = SnakeCased<AppUser>
 * // {
 * //   user_id: number;
 * //   first_name: string;
 * //   created_at: Date;
 * // }
 * ```
 */
export type SnakeCased<T> = {
  [K in keyof T as SnakeCase<string & K>]: T[K] extends object
    ? T[K] extends Date
      ? T[K]
      : SnakeCased<T[K]>
    : T[K];
};

/**
 * Helper type specifically for converting Drizzle InferSelectModel types to camelCase.
 * This is a specialized version of CamelCased that's optimized for database schema types.
 *
 * @example
 * ```typescript
 * import { InferSelectModel } from 'drizzle-orm';
 * import { users } from './schema';
 *
 * type DbUser = InferSelectModel<typeof users>;
 * type AppUser = DrizzleToCamelCase<DbUser>;
 * ```
 */
export type DrizzleToCamelCase<T> = CamelCased<T>;
