/**
 * Internal API endpoint for authentication metrics monitoring
 * Used to track Phase 1 consolidation progress
 */

import { NextResponse } from 'next/server';
import { getAuthMetrics, resetAuthMetrics } from '~/lib/auth/instrumentation';

export async function GET() {
  const snapshot = getAuthMetrics();

  // The instrumentation module only exposes an aggregated breakdown map. We
  // derive the legacy vs canonical counts from the keys in that map.
  const resolverEntries = Object.entries(snapshot.resolverBreakdown);
  const canonicalCalls = resolverEntries
    .filter(([k]) => k.startsWith('getRequestAuthContext'))
    .reduce((sum, [, v]) => sum + v, 0);
  const totalResolverCalls = snapshot.totalResolverCalls;
  const legacyCalls = totalResolverCalls - canonicalCalls;

  const response = {
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
  };

  return NextResponse.json(response);
}

export async function POST() {
  resetAuthMetrics();
  return NextResponse.json({ message: 'Auth metrics reset successfully' });
}