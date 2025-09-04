/**
 * Request-scoped authentication tracking for Wave 0 baseline measurement
 * Provides per-request context and detailed auth call analysis
 */

import { getStackSignature, trackDuplicateAuthCall } from './instrumentation';

interface RequestContext {
  id: string;
  route: string;
  startTime: number;
  authCalls: AuthCall[];
  cacheEvents: CacheEvent[];
}

interface AuthCall {
  function: string;
  timestamp: number;
  duration: number;
  stackTrace: string;
  isDuplicate: boolean;
}

interface CacheEvent {
  timestamp: number;
  eventType: 'hit' | 'miss';
  cacheKey?: string;
}

interface RequestSummary {
  requestId: string;
  route: string;
  totalDuration: number;
  authCallCount: number;
  duplicateCallCount: number;
  authResolutionsPerRequest: number;
  cacheHitRate: number;
  authCalls: AuthCall[];
  performance: {
    averageAuthCallLatency: number;
    slowestAuthCall: string;
    fastestAuthCall: string;
  };
}

/**
 * Request tracker for per-request auth call analysis
 */
export class RequestTracker {
  private activeRequests = new Map<string, RequestContext>();
  private completedRequests: RequestSummary[] = [];
  private maxCompletedRequests = 1000; // Keep last 1000 for analysis

  /**
   * Start tracking a new request
   */
  startRequest(route: string): string {
    const requestId = this.generateRequestId();
    const requestContext: RequestContext = {
      id: requestId,
      route,
      startTime: Date.now(),
      authCalls: [],
      cacheEvents: []
    };
    
    this.activeRequests.set(requestId, requestContext);
    return requestId;
  }

  /**
   * Track an authentication function call within a request
   */
  trackAuthCall(requestId: string, functionName: string): void {
    const context = this.activeRequests.get(requestId);
    if (!context) {
      // Request might have ended already, create a temporary entry
      console.warn(`[REQUEST-TRACKER] No active request found for ID: ${requestId}`);
      return;
    }

    const authCall: AuthCall = {
      function: functionName,
      timestamp: Date.now(),
      duration: 0, // Will be updated when call completes
      stackTrace: getStackSignature(4),
      isDuplicate: this.isDuplicateCall(context, functionName)
    };

    context.authCalls.push(authCall);

    // Track duplicate for global metrics
    if (authCall.isDuplicate) {
      trackDuplicateAuthCall(requestId, functionName);
    }
  }

  /**
   * Complete an auth call timing (if we can track duration)
   */
  completeAuthCall(requestId: string, functionName: string, duration: number): void {
    const context = this.activeRequests.get(requestId);
    if (!context) return;

    // Find the most recent call to this function and update its duration
    for (let i = context.authCalls.length - 1; i >= 0; i--) {
      const call = context.authCalls[i];
      if (call.function === functionName && call.duration === 0) {
        call.duration = duration;
        break;
      }
    }
  }

  /**
   * Track a cache event within a request
   */
  trackCacheEvent(requestId: string, eventType: 'hit' | 'miss', cacheKey?: string): void {
    const context = this.activeRequests.get(requestId);
    if (!context) return;

    const cacheEvent: CacheEvent = {
      timestamp: Date.now(),
      eventType,
      cacheKey
    };

    context.cacheEvents.push(cacheEvent);
  }

  /**
   * End a request and generate summary
   */
  endRequest(requestId: string): RequestSummary {
    const context = this.activeRequests.get(requestId);
    if (!context) {
      throw new Error(`Request ${requestId} not found or already ended`);
    }

    const totalDuration = Date.now() - context.startTime;
    const authCallCount = context.authCalls.length;
    const duplicateCallCount = context.authCalls.filter(call => call.isDuplicate).length;
    const cacheHitRate = this.calculateCacheHitRate(context);

    // Calculate performance metrics
    const authCallLatencies = context.authCalls
      .filter(call => call.duration > 0)
      .map(call => call.duration);
    
    const averageAuthCallLatency = authCallLatencies.length > 0 
      ? authCallLatencies.reduce((sum, lat) => sum + lat, 0) / authCallLatencies.length
      : 0;

    const slowestCall = context.authCalls
      .reduce((slowest, call) => call.duration > slowest.duration ? call : slowest, 
              { function: 'none', duration: 0 });
    
    const fastestCall = context.authCalls
      .reduce((fastest, call) => call.duration < fastest.duration && call.duration > 0 ? call : fastest,
              { function: 'none', duration: Number.MAX_VALUE });

    const summary: RequestSummary = {
      requestId,
      route: context.route,
      totalDuration,
      authCallCount,
      duplicateCallCount,
      authResolutionsPerRequest: authCallCount,
      cacheHitRate,
      authCalls: context.authCalls,
      performance: {
        averageAuthCallLatency: Math.round(averageAuthCallLatency),
        slowestAuthCall: slowestCall.function,
        fastestAuthCall: fastestCall.duration === Number.MAX_VALUE ? 'none' : fastestCall.function
      }
    };

    // Store completed request
    this.completedRequests.push(summary);
    
    // Keep only last N requests to prevent memory leak
    if (this.completedRequests.length > this.maxCompletedRequests) {
      this.completedRequests = this.completedRequests.slice(-this.maxCompletedRequests);
    }

    // Clean up active request
    this.activeRequests.delete(requestId);

    return summary;
  }

  /**
   * Get all completed request summaries
   */
  getCompletedRequests(): RequestSummary[] {
    return [...this.completedRequests];
  }

  /**
   * Get aggregated metrics across all completed requests
   */
  getAggregatedMetrics() {
    if (this.completedRequests.length === 0) {
      return {
        totalRequests: 0,
        averageAuthCallsPerRequest: 0,
        totalDuplicateCalls: 0,
        averageCacheHitRate: 0,
        averageRequestDuration: 0
      };
    }

    const totalAuthCalls = this.completedRequests.reduce((sum, req) => sum + req.authCallCount, 0);
    const totalDuplicateCalls = this.completedRequests.reduce((sum, req) => sum + req.duplicateCallCount, 0);
    const totalCacheHitRate = this.completedRequests.reduce((sum, req) => sum + req.cacheHitRate, 0);
    const totalRequestDuration = this.completedRequests.reduce((sum, req) => sum + req.totalDuration, 0);

    return {
      totalRequests: this.completedRequests.length,
      averageAuthCallsPerRequest: totalAuthCalls / this.completedRequests.length,
      totalDuplicateCalls,
      averageCacheHitRate: totalCacheHitRate / this.completedRequests.length,
      averageRequestDuration: totalRequestDuration / this.completedRequests.length
    };
  }

  /**
   * Clear all tracking data (for testing)
   */
  reset(): void {
    this.activeRequests.clear();
    this.completedRequests = [];
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if an auth call is a duplicate within the same request
   */
  private isDuplicateCall(context: RequestContext, functionName: string): boolean {
    return context.authCalls.some(call => call.function === functionName);
  }

  /**
   * Calculate cache hit rate for a request
   */
  private calculateCacheHitRate(context: RequestContext): number {
    const cacheEvents = context.cacheEvents;
    if (cacheEvents.length === 0) return 0;

    const hits = cacheEvents.filter(event => event.eventType === 'hit').length;
    return hits / cacheEvents.length;
  }
}

// Global instance for the application
export const globalRequestTracker = new RequestTracker();

/**
 * Helper functions for easy integration
 */

export function startTracking(route: string): string {
  return globalRequestTracker.startRequest(route);
}

export function trackAuth(requestId: string, functionName: string): void {
  globalRequestTracker.trackAuthCall(requestId, functionName);
}

export function trackCache(requestId: string, eventType: 'hit' | 'miss', cacheKey?: string): void {
  globalRequestTracker.trackCacheEvent(requestId, eventType, cacheKey);
}

export function endTracking(requestId: string): RequestSummary {
  return globalRequestTracker.endRequest(requestId);
}

export function getTrackingMetrics() {
  return globalRequestTracker.getAggregatedMetrics();
}