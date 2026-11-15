/**
 * Deployment-tier predicates: the one place PinPoint reads `NODE_ENV` and
 * `VERCEL_ENV` to decide which tier server code is running in.
 *
 * The two variables answer different questions, so the predicates do not
 * collapse into one. `NODE_ENV` is the build mode: `production` for every
 * `next build` output, Vercel previews and the E2E production build included.
 * `VERCEL_ENV` names the deployment: `production`, `preview`, or
 * `development`, and is unset off Vercel (PP-o355.24). Pick the predicate whose
 * tiers match the decision, and combine them at the call site when one decision
 * needs both signals.
 *
 * Every predicate reads the environment when called, so tests stub it with
 * `vi.stubEnv`.
 */

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

/**
 * Whether this is a Vercel production deployment (`VERCEL_ENV=production`).
 * Fails closed: an unset, empty, or unrecognised `VERCEL_ENV` is not, so no
 * off-Vercel build ever counts, whatever its `NODE_ENV`.
 */
export function isVercelProduction(): boolean {
  return process.env["VERCEL_ENV"] === "production";
}

/** Whether this is a Vercel preview deployment (`VERCEL_ENV=preview`). */
export function isVercelPreview(): boolean {
  return process.env["VERCEL_ENV"] === "preview";
}

/**
 * Whether this is a production build (`NODE_ENV=production`): Vercel
 * production and preview deployments, the E2E production build, and any
 * off-Vercel `next start`.
 */
export function isProductionBuild(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Whether this is local development: a development build (`next dev`) that is
 * not a Vercel production or preview deployment. `vercel dev`
 * (`VERCEL_ENV=development`) counts; tests (`NODE_ENV=test`) do not.
 */
export function isLocalDevelopment(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    !isVercelProduction() &&
    !isVercelPreview()
  );
}
