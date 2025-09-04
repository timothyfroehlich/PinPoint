import { NextResponse } from 'next/server';
import { getAuthMetrics, logMetricsSummary } from '~/lib/auth/instrumentation';

// Internal endpoint to inspect auth consolidation progress.
// Only exposed in non-production environments.
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not Found', { status: 404 });
  }

  const snapshot = getAuthMetrics();
  logMetricsSummary();

  const resolverEntries = Object.entries(snapshot.resolverBreakdown);
  const canonicalCalls = resolverEntries
    .filter(([k]) => k.startsWith('getRequestAuthContext'))
    .reduce((sum, [, v]) => sum + (v as number), 0);
  const totalResolverCalls = snapshot.totalResolverCalls;
  const legacyCalls = totalResolverCalls - canonicalCalls;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    phase1Progress: {
      authResolutionsPerRequest: Number(snapshot.authResolutionsPerRequest.toFixed(2)),
      target: '<= 1.2',
      status: snapshot.authResolutionsPerRequest <= 1.2 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    },
    breakdown: {
      totalRequests: snapshot.requestCount,
      totalResolverCalls,
      canonicalCalls,
      legacyCalls,
      legacyPercentage: totalResolverCalls > 0 ? Number(((legacyCalls / totalResolverCalls) * 100).toFixed(1)) : 0
    },
    resolverCalls: snapshot.resolverBreakdown,
    uptime: snapshot.uptime
  });
}
