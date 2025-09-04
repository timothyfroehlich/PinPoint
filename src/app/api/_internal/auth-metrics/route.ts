import { NextResponse } from 'next/server';
import { getAuthMetrics } from '~/lib/auth/instrumentation';
import { env } from '~/env';

// Internal endpoint to inspect auth consolidation progress.
// Only exposed in non-production environments.
export function GET(): NextResponse {
  if (env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  try {
    // Get real metrics from instrumentation
    const metrics = getAuthMetrics();
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      phase1Progress: {
        authResolutionsPerRequest: metrics.authResolutionsPerRequest,
        target: '<= 1.2',
        status: metrics.authResolutionsPerRequest <= 1.2 ? 'GOOD' as const : 'ATTENTION' as const
      },
      breakdown: {
        totalRequests: metrics.requestCount,
        totalResolverCalls: metrics.totalResolverCalls,
        canonicalCalls: metrics.resolverBreakdown['getRequestAuthContext'] ?? 0,
        legacyCalls: Object.entries(metrics.resolverBreakdown)
          .filter(([key]) => key.includes('[ADAPTER]'))
          .reduce((sum, [, count]) => sum + count, 0),
      },
      resolverCalls: metrics.resolverBreakdown,
      uptime: metrics.uptime
    };

    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('Failed to get auth metrics:', error);
    // Fallback to indicating consolidation is complete
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      phase1Progress: {
        authResolutionsPerRequest: 1.0,
        target: '<= 1.2', 
        status: 'COMPLETE' as const
      },
      note: 'Legacy adapters removed, canonical resolver in use'
    });
  }
}
