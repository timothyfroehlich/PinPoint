/**
 * Type-level Utilities
 *
 * String transformation types and utility types for compile-time operations.
 */

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
