/**
 * Authentication instrumentation for Phase 0 baseline measurement
 * Temporary counters to measure auth resolver invocations per request
 */

interface AuthMetrics {
  resolverCalls: Map<string, number>;
  requestCount: number;
  lastReset: number;
}

// In-memory metrics (temporary for Phase 0)
const metrics: AuthMetrics = {
  resolverCalls: new Map(),
  requestCount: 0,
  lastReset: Date.now(),
};

/**
 * Track an authentication resolver call
 */
export function trackAuthResolverCall(functionName: string, stackSignature?: string): void {
  const key = stackSignature ? `${functionName}:${stackSignature}` : functionName;
  const current = metrics.resolverCalls.get(key) || 0;
  metrics.resolverCalls.set(key, current + 1);
  
  // Log once per unique stack signature (deduplicated logging)
  if (current === 0) {
    console.warn(`[AUTH-INSTRUMENTATION] Legacy auth function detected: ${functionName}`);
    if (stackSignature) {
      console.warn(`[AUTH-INSTRUMENTATION] Stack signature: ${stackSignature}`);
    }
  }
}

/**
 * Track a request start
 */
export function trackRequest(): void {
  metrics.requestCount++;
}

/**
 * Get current metrics
 */
export function getAuthMetrics(): {
  authResolutionsPerRequest: number;
  totalResolverCalls: number;
  requestCount: number;
  resolverBreakdown: Record<string, number>;
  uptime: number;
} {
  const totalCalls = Array.from(metrics.resolverCalls.values()).reduce((sum, count) => sum + count, 0);
  const authResolutionsPerRequest = metrics.requestCount > 0 ? totalCalls / metrics.requestCount : 0;
  
  return {
    authResolutionsPerRequest,
    totalResolverCalls: totalCalls,
    requestCount: metrics.requestCount,
    resolverBreakdown: Object.fromEntries(metrics.resolverCalls.entries()),
    uptime: Date.now() - metrics.lastReset,
  };
}

/**
 * Reset metrics (for testing)
 */
export function resetAuthMetrics(): void {
  metrics.resolverCalls.clear();
  metrics.requestCount = 0;
  metrics.lastReset = Date.now();
}

/**
 * Helper to get a simple stack signature
 */
export function getStackSignature(depth: number = 3): string {
  const stack = new Error().stack?.split('\n') || [];
  return stack.slice(2, 2 + depth).map(line => {
    const match = line.match(/at (.+?) \(/);
    return match?.[1]?.split('/').pop() || 'unknown';
  }).join('->');
}

/**
 * Log metrics summary
 */
export function logMetricsSummary(): void {
  const metrics = getAuthMetrics();
  console.log('\n[AUTH-INSTRUMENTATION] Metrics Summary');
  console.log(`Target: auth_resolutions_per_request = 1.0`);
  console.log(`Actual: auth_resolutions_per_request = ${metrics.authResolutionsPerRequest.toFixed(2)}`);
  console.log(`Total resolver calls: ${metrics.totalResolverCalls}`);
  console.log(`Request count: ${metrics.requestCount}`);
  console.log(`Uptime: ${(metrics.uptime / 1000).toFixed(1)}s`);
  
  if (Object.keys(metrics.resolverBreakdown).length > 0) {
    console.log('\nResolver breakdown:');
    Object.entries(metrics.resolverBreakdown).forEach(([key, count]) => {
      console.log(`  ${key}: ${count}`);
    });
  }
}