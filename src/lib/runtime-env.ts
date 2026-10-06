/**
 * Whether this server is running as the production deployment.
 *
 * `VERCEL_ENV` decides whenever it is set: only `production` counts, so a
 * preview deployment and a local `next start` run with
 * `VERCEL_ENV=development` (the E2E harness against a production build) are
 * both non-production even though `NODE_ENV` is `production` in each. Off
 * Vercel, with `VERCEL_ENV` unset or empty, `NODE_ENV` decides.
 */
export function isProductionRuntime(): boolean {
  const vercelEnv = process.env["VERCEL_ENV"];
  if (vercelEnv) return vercelEnv === "production";
  return process.env.NODE_ENV === "production";
}
