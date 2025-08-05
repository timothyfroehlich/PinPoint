/**
 * Test environment loader for test contexts
 * Ensures consistent environment variable loading across all test scenarios
 * Following Next.js 15 environment loading patterns
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { config } from "dotenv";

/**
 * Load environment variables with proper precedence for testing
 * Follows Next.js environment loading behavior with test-specific additions:
 * 1. .env (shared defaults)
 * 2. .env.development (for development features)
 * 3. .env.test (test-specific overrides, highest precedence for tests)
 * 4. .env.local (local overrides, ignored by git)
 */
export function loadTestEnvironment(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = resolve(__dirname, "../../../");

  // Load in order of precedence (later files override earlier ones)
  // 1. Base configuration
  config({ path: resolve(projectRoot, ".env") });

  // 2. Development configuration (for development features in tests)
  config({ path: resolve(projectRoot, ".env.development") });

  // 3. Test-specific configuration (highest precedence for test environment)
  config({ path: resolve(projectRoot, ".env.test") });

  // 4. Local overrides (if they exist, for developer-specific test settings)
  config({ path: resolve(projectRoot, ".env.local") });

  // Ensure test environment has NODE_ENV set
  // eslint-disable-next-line no-restricted-properties, @typescript-eslint/dot-notation, @typescript-eslint/no-unnecessary-condition
  if (!process.env["NODE_ENV"]) {
    // eslint-disable-next-line no-restricted-properties, @typescript-eslint/dot-notation
    (process.env as { NODE_ENV?: string })["NODE_ENV"] = "test";
  }
}

// Auto-load when this module is imported
loadTestEnvironment();
