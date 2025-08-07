/**
 * Production environment loader for standalone scripts
 * Ensures consistent environment variable loading for production contexts
 * Following Next.js 15 environment loading patterns
 */
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { config } from "dotenv";

/**
 * Load environment variables with proper precedence for production scripts
 * Follows Next.js environment loading behavior:
 * 1. .env (shared defaults)
 * 2. .env.production (production-specific settings, highest precedence)
 * 3. .env.local (local overrides, ignored by git - optional)
 */
export function loadProductionEnvironment(): void {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = resolve(__dirname, "../../../");

  // Load in order of precedence (later files override earlier ones)
  // 1. Base configuration
  config({ path: resolve(projectRoot, ".env") });

  // 2. Production configuration (highest precedence for production environment)
  config({ path: resolve(projectRoot, ".env.production") });

  // 3. Local overrides (if they exist, for deployment-specific settings)
  config({ path: resolve(projectRoot, ".env.local") });

  // Ensure production environment has NODE_ENV set
  // eslint-disable-next-line @typescript-eslint/dot-notation, no-restricted-properties, @typescript-eslint/no-unnecessary-condition
  if (!process.env["NODE_ENV"]) {
    // eslint-disable-next-line no-restricted-properties, @typescript-eslint/dot-notation
    (process.env as { NODE_ENV?: string })["NODE_ENV"] = "production";
  }
}

// Auto-load when this module is imported
loadProductionEnvironment();
