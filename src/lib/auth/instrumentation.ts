/**
 * Authentication instrumentation for Wave 0 baseline measurement
 * Enhanced metrics collection for auth resolver patterns and performance
 */

interface AuthMetrics {
  resolverCalls: Map<string, number>;
  requestCount: number;
  lastReset: number;
  // NEW METRICS for Wave 0
  requestLatency: number[]; // Auth resolution timing per request
  duplicateCallPatterns: Map<string, number>; // Same request, multiple auth calls
  cacheHitRate: number; // cache() effectiveness tracking
  routeBreakdown: Map<string, RouteMetrics>; // Per-route analysis
}

interface RouteMetrics {
  authCallCount: number;
  averageLatency: number;
  cacheHits: number;
  cacheMisses: number;
  duplicateCalls: number;
}

interface RequestSummary {
  requestId: string;
  route: string;
  totalDuration: number;
  authCallCount: number;
  duplicateCallCount: number;
  authResolutionsPerRequest: number;
  cacheHitRate: number;
}

interface MetricsSnapshot {
  captureDate: string;
  targetMetrics: {
    authResolutionsPerRequest: { target: number; current: number; deviation: number; status: string };
    duplicateQueryDetection: { target: number; current: number; status: string };
    cacheHitRate: { target: number; current: number; status: string };
  };
  routeBreakdown: Array<{
    route: string;
    averageAuthCalls: number;
    averageLatency: number;
    duplicateCallsDetected: boolean;
    cacheEffectiveness: number;
    issues: string[];
  }>;
  performance: {
    averageAuthLatency: number;
    p95AuthLatency: number;
    slowestRoute: string;
    fastestRoute: string;
    cacheOverallHitRate: number;
  };
}

// In-memory metrics (temporary for Wave 0)
const metrics: AuthMetrics = {
  resolverCalls: new Map(),
  requestCount: 0,
  lastReset: Date.now(),
  // NEW METRICS initialization
  requestLatency: [],
  duplicateCallPatterns: new Map(),
  cacheHitRate: 0,
  routeBreakdown: new Map(),
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
  // NEW METRICS reset
  metrics.requestLatency = [];
  metrics.duplicateCallPatterns.clear();
  metrics.cacheHitRate = 0;
  metrics.routeBreakdown.clear();
}

// NEW FUNCTIONS for Wave 0 enhanced metrics

/**
 * Start timing a request for latency measurement
 */
export function startRequestTimer(requestId: string): void {
  // Store start time in a simple Map for now
  if (!globalThis.__authRequestTimers) {
    globalThis.__authRequestTimers = new Map<string, number>();
  }
  globalThis.__authRequestTimers.set(requestId, Date.now());
}

/**
 * End timing a request and record latency
 */
export function endRequestTimer(requestId: string): void {
  if (!globalThis.__authRequestTimers) return;
  
  const startTime = globalThis.__authRequestTimers.get(requestId);
  if (startTime) {
    const latency = Date.now() - startTime;
    metrics.requestLatency.push(latency);
    globalThis.__authRequestTimers.delete(requestId);
    
    // Keep only last 1000 measurements to prevent memory leak
    if (metrics.requestLatency.length > 1000) {
      metrics.requestLatency = metrics.requestLatency.slice(-1000);
    }
  }
}

/**
 * Track duplicate authentication call within same request
 */
export function trackDuplicateAuthCall(requestId: string, functionName: string): void {
  const key = `${functionName}`;
  const current = metrics.duplicateCallPatterns.get(key) || 0;
  metrics.duplicateCallPatterns.set(key, current + 1);
}

/**
 * Track cache hit/miss events
 */
export function trackCacheEvent(requestId: string, eventType: 'hit' | 'miss'): void {
  // Simple hit rate calculation - this could be enhanced
  const totalEvents = (metrics.cacheHitRate * 100) || 0;
  if (eventType === 'hit') {
    metrics.cacheHitRate = (totalEvents + 1) / (totalEvents + 1);
  } else {
    metrics.cacheHitRate = totalEvents / (totalEvents + 1);
  }
}

/**
 * Get metrics for specific route
 */
export function getRouteMetrics(route: string): RouteMetrics {
  return metrics.routeBreakdown.get(route) || {
    authCallCount: 0,
    averageLatency: 0,
    cacheHits: 0,
    cacheMisses: 0,
    duplicateCalls: 0,
  };
}

/**
 * Export comprehensive metrics snapshot
 */
export function exportMetricsSnapshot(): MetricsSnapshot {
  const currentMetrics = getAuthMetrics();
  const avgLatency = metrics.requestLatency.length > 0 
    ? metrics.requestLatency.reduce((sum, lat) => sum + lat, 0) / metrics.requestLatency.length 
    : 0;
  
  const p95Index = Math.floor(metrics.requestLatency.length * 0.95);
  const sortedLatencies = [...metrics.requestLatency].sort((a, b) => a - b);
  const p95Latency = sortedLatencies[p95Index] || 0;

  return {
    captureDate: new Date().toISOString(),
    targetMetrics: {
      authResolutionsPerRequest: {
        target: 1.0,
        current: currentMetrics.authResolutionsPerRequest,
        deviation: Math.round(((currentMetrics.authResolutionsPerRequest - 1.0) / 1.0) * 100),
        status: currentMetrics.authResolutionsPerRequest <= 1.2 ? 'good' : 'needs-improvement'
      },
      duplicateQueryDetection: {
        target: 0,
        current: Array.from(metrics.duplicateCallPatterns.values()).reduce((sum, count) => sum + count, 0),
        status: metrics.duplicateCallPatterns.size === 0 ? 'good' : 'failing'
      },
      cacheHitRate: {
        target: 0.8,
        current: metrics.cacheHitRate,
        status: metrics.cacheHitRate >= 0.8 ? 'good' : 'needs-improvement'
      }
    },
    routeBreakdown: Array.from(metrics.routeBreakdown.entries()).map(([route, routeMetrics]) => ({
      route,
      averageAuthCalls: routeMetrics.authCallCount,
      averageLatency: routeMetrics.averageLatency,
      duplicateCallsDetected: routeMetrics.duplicateCalls > 0,
      cacheEffectiveness: routeMetrics.cacheHits / (routeMetrics.cacheHits + routeMetrics.cacheMisses) || 0,
      issues: [
        ...(routeMetrics.authCallCount > 2 ? [`High auth call count (${routeMetrics.authCallCount})`] : []),
        ...(routeMetrics.duplicateCalls > 0 ? [`${routeMetrics.duplicateCalls} duplicate calls detected`] : []),
        ...(routeMetrics.cacheHits / (routeMetrics.cacheHits + routeMetrics.cacheMisses) < 0.8 ? [`Low cache hit rate`] : []),
      ]
    })),
    performance: {
      averageAuthLatency: Math.round(avgLatency),
      p95AuthLatency: Math.round(p95Latency),
      slowestRoute: 'TBD', // Would need route-specific tracking
      fastestRoute: 'TBD',
      cacheOverallHitRate: metrics.cacheHitRate
    }
  };
}

/**
 * Helper to get a simple stack signature
 */
export function getStackSignature(depth = 3): string {
  const stack = new Error().stack?.split('\n') || [];
  return stack.slice(2, 2 + depth).map(line => {
    const match = /at (.+?) \(/.exec(line);
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