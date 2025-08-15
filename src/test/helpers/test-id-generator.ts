/**
 * Test ID Generator
 *
 * Provides utilities for generating unique, collision-free IDs for tests.
 * Uses crypto.randomUUID() and worker-specific prefixes to ensure uniqueness
 * even when tests run in parallel across multiple workers.
 */

/**
 * Generate a unique test ID
 *
 * @param prefix - Optional prefix for the ID (e.g., 'test-org', 'test-user')
 * @returns Unique ID guaranteed to be collision-free across parallel tests
 */
export function generateTestId(prefix = "test"): string {
  const workerId = process.env.VITEST_WORKER_ID ?? "w0";
  const randomId = crypto.randomUUID().slice(0, 8); // Use first 8 chars for brevity
  return `${prefix}-${workerId}-${randomId}`;
}

/**
 * Generate a unique test email
 *
 * @param prefix - Optional prefix for the email username
 * @returns Unique email guaranteed to be collision-free across parallel tests
 */
export function generateTestEmail(prefix = "test"): string {
  const workerId = process.env.VITEST_WORKER_ID ?? "w0";
  const randomId = crypto.randomUUID().slice(0, 8);
  return `${prefix}-${workerId}-${randomId}@example.com`;
}

/**
 * Generate a unique test subdomain
 *
 * @param prefix - Optional prefix for the subdomain
 * @returns Unique subdomain guaranteed to be collision-free across parallel tests
 */
export function generateTestSubdomain(prefix = "test"): string {
  const workerId = process.env.VITEST_WORKER_ID ?? "w0";
  const randomId = crypto.randomUUID().slice(0, 8);
  return `${prefix}-${workerId}-${randomId}`;
}

/**
 * Generate multiple unique test IDs at once
 *
 * @param count - Number of IDs to generate
 * @param prefix - Optional prefix for the IDs
 * @returns Array of unique IDs
 */
export function generateTestIds(count: number, prefix = "test"): string[] {
  return Array.from({ length: count }, () => generateTestId(prefix));
}
