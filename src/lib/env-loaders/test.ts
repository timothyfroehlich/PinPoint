/**
 * Test environment loader for test contexts
 * Ensures consistent environment variable loading across all test scenarios
 * Following Next.js 15 environment loading patterns
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { config } from "dotenv";

/**
 * Load environment variables with proper precedence for testing.
 *
 * This environment loading ensures consistent database configuration across test environments
 * by establishing a clear precedence hierarchy that respects both CI and local development needs.
 *
 * **Loading Order (earlier files provide defaults, later files override):**
 * 1. `.env` - Shared defaults for all environments
 * 2. `.env.development` - Development features needed in tests
 * 3. `.env.test` - Test-specific overrides (DATABASE_URL, etc.)
 * 4. `.env.local` - Developer-specific local overrides
 *
 * **CI/CD Behavior:**
 * - CI environment variables have highest precedence (override: false preserves them)
 * - Local .env files only set variables that don't already exist
 * - Ensures ephemeral CI database URLs aren't overridden by local configs
 *
 * **Why This Pattern:**
 * - **Consistency**: Same database config across unit, integration, and E2E tests
 * - **Flexibility**: Developers can override locally without affecting CI
 * - **Safety**: CI database URLs take precedence over potentially stale local configs
 * - **Next.js Compliance**: Follows Next.js 15 environment loading patterns
 */
export function loadTestEnvironment(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = resolve(__dirname, "../../../");

  // Load in order of precedence (CI environment variables have highest precedence)
  // Only set variables if they don't already exist (preserve CI environment)
  // 1. Base configuration
  config({ path: resolve(projectRoot, ".env"), override: false });

  // 2. Development configuration (for development features in tests)
  config({ path: resolve(projectRoot, ".env.development"), override: false });

  // 3. Test-specific configuration
  config({ path: resolve(projectRoot, ".env.test"), override: false });

  // 4. Local overrides (if they exist, for developer-specific test settings)
  config({ path: resolve(projectRoot, ".env.local"), override: false });

  // Ensure test environment has NODE_ENV set
  // eslint-disable-next-line no-restricted-properties, @typescript-eslint/dot-notation, @typescript-eslint/no-unnecessary-condition
  if (!process.env["NODE_ENV"]) {
    // eslint-disable-next-line no-restricted-properties, @typescript-eslint/dot-notation
    (process.env as { NODE_ENV?: string })["NODE_ENV"] = "test";
  }
}

// Auto-load when this module is imported
loadTestEnvironment();
