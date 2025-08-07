/**
 * Development environment loader for standalone scripts
 * Ensures consistent environment variable loading for development contexts
 * Following Next.js 15 environment loading patterns
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { config } from "dotenv";

/**
 * Load environment variables with proper precedence for development scripts
 * Follows Next.js environment loading behavior:
 * 1. .env (shared defaults)
 * 2. .env.development (development-specific settings, highest precedence)
 * 3. .env.local (local overrides, ignored by git - optional)
 */
export function loadDevelopmentEnvironment(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = resolve(__dirname, "../../../");

  // Load in order of precedence (later files override earlier ones)
  // 1. Base configuration
  config({ path: resolve(projectRoot, ".env") });

  // 2. Development configuration (highest precedence for development environment)
  config({ path: resolve(projectRoot, ".env.development") });

  // 3. Local overrides (if they exist, for developer-specific settings)
  config({ path: resolve(projectRoot, ".env.local") });

  // Ensure development environment has NODE_ENV set
  // eslint-disable-next-line @typescript-eslint/dot-notation, no-restricted-properties, @typescript-eslint/no-unnecessary-condition
  if (!process.env["NODE_ENV"]) {
    // eslint-disable-next-line no-restricted-properties, @typescript-eslint/dot-notation
    (process.env as { NODE_ENV?: string })["NODE_ENV"] = "development";
  }
}

// Auto-load when this module is imported
loadDevelopmentEnvironment();
