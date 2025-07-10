/**
 * Version utility for accessing npm package version
 *
 * This encapsulates access to process.env.npm_package_version which is only
 * available when the application is started via npm scripts (e.g., npm start).
 * In production deployments or when started directly with Node.js, this will
 * return "unknown".
 *
 * This is an acceptable use of process.env because npm_package_version is not
 * a configuration variable but a runtime environment provided by npm itself.
 */
export function getVersion(): string {
  return process.env.npm_package_version ?? "unknown";
}
