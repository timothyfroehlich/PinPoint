/**
 * Guard & Result Types
 *
 * Shared, generic result containers for validations and operations.
 * Adopt incrementally by importing from '~/lib/types'.
 */

export type ValidationSuccess<T = void> = { ok: true; data: T };
export type ValidationFailure = { ok: false; error: string; code?: string };
export type ValidationResult<T = void> = ValidationSuccess<T> | ValidationFailure;

export type OperationSuccess<T = unknown> = { ok: true; data: T };
export type OperationFailure = { ok: false; error: string; code?: string };
export type OperationResult<T = unknown> = OperationSuccess<T> | OperationFailure;

