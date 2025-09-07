/**
 * Guard & Result Types
 *
 * Shared, generic result containers for validations and operations.
 * Adopt incrementally by importing from '~/lib/types'.
 */

export interface ValidationSuccess<T = void> {
  ok: true;
  data: T;
}
export interface ValidationFailure {
  ok: false;
  error: string;
  code?: string;
}
export type ValidationResult<T = void> =
  | ValidationSuccess<T>
  | ValidationFailure;

export interface OperationSuccess<T = unknown> {
  ok: true;
  data: T;
}
export interface OperationFailure {
  ok: false;
  error: string;
  code?: string;
}
export type OperationResult<T = unknown> =
  | OperationSuccess<T>
  | OperationFailure;
