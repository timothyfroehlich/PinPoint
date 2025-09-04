/**
 * Wave 0 Authentication Performance Measurement
 * Tests core routes to measure auth resolver patterns and performance
 */

import { resetAuthMetrics, getAuthMetrics } from '~/lib/auth/instrumentation';
import { globalRequestTracker } from '~/lib/auth/request-tracker';

interface RouteTestConfig {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  expectedAuthCalls: number; // Expected number for validation
}

interface RequestMeasurement {
  statusCode: number;
  totalLatency: number;
  authCallCount: number;
  duplicateCalls: number;
  cacheHitRate: number;
  resolverBreakdown: Record<string, number>;
  headers: Record<string, string>;
}

interface RouteTestResult {
  route: string;
  path: string;
  measurements: RequestMeasurement[];
  averageAuthCalls: number;
  averageLatency: number;
  duplicateCallsDetected: boolean;
  cacheEffectiveness: number;
  issues: string[];
}

interface BaselineMetrics {
  measurementDate: string;
  testConfiguration: {
    iterations: number;
    testRoutes: number;
    serverUrl: string;
  };
  routes: RouteTestResult[];
  summary: {
    totalRequests: number;
    averageAuthCallsPerRequest: number;
    totalDuplicateCalls: number;
    averageCacheHitRate: number;
    averageRequestLatency: number;
    problemRoutes: string[];
  };
  targetAnalysis: {
    authResolutionsPerRequestTarget: number;
    authResolutionsPerRequestActual: number;
    duplicateQueryTarget: number;
    duplicateQueryActual: number;
    cacheHitRateTarget: number;
    cacheHitRateActual: number;
  };
}

const CORE_ROUTES: RouteTestConfig[] = [
  {
    name: 'Dashboard',
    path: '/dashboard',
    method: 'GET',
    expectedAuthCalls: 1
  },
  {
    name: 'Issues List', 
    path: '/issues',
    method: 'GET',
    expectedAuthCalls: 1
  },
  {
    name: 'Machines List',
    path: '/machines', 
    method: 'GET',
    expectedAuthCalls: 1
  },
  {
    name: 'Universal Search API',
    path: '/api/search/universal',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    expectedAuthCalls: 1
  },
  {
    name: 'Settings Activity',
    path: '/settings/activity',
    method: 'GET', 
    expectedAuthCalls: 1
  },
  {
    name: 'Settings Users',
    path: '/settings/users',
    method: 'GET',
    expectedAuthCalls: 1
  },
  {
    name: 'Issues by Machine API',
    path: '/api/issues/by-machine',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    expectedAuthCalls: 1
  }
];

export class AuthPerformanceTester {
  private readonly serverUrl: string;
  private authCookie: string | null = null;

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
  }

  /**
   * Execute baseline performance measurement across all core routes
   */
  async measureBaselinePerformance(iterations: number = 10): Promise<BaselineMetrics> {
    console.log('🔍 Starting Wave 0 baseline auth performance measurement...');
    console.log(`Server: ${this.serverUrl}`);
    console.log(`Iterations per route: ${iterations}`);
    console.log(`Total routes: ${CORE_ROUTES.length}`);
    
    // Verify server is available
    await this.verifyServerAvailable();
    
    // Get authentication for testing
    await this.setupAuthentication();
    
    const results: RouteTestResult[] = [];
    
    for (const route of CORE_ROUTES) {
      console.log(`\n📊 Testing ${route.name} (${route.path})...`);
      
      // Reset metrics for clean measurement
      resetAuthMetrics();
      globalRequestTracker.reset();
      
      // Make multiple requests to get reliable averages
      const measurements: RequestMeasurement[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const measurement = await this.measureSingleRequest(route);
        measurements.push(measurement);
        
        // Small delay between requests to avoid overwhelming
        await this.sleep(100);
      }
      
      const routeResult = this.analyzeRouteMeasurements(route, measurements);
      results.push(routeResult);
      
      // Log immediate results
      console.log(`   Average auth calls: ${routeResult.averageAuthCalls.toFixed(2)}`);
      console.log(`   Average latency: ${routeResult.averageLatency}ms`);
      console.log(`   Duplicate calls: ${routeResult.duplicateCallsDetected ? 'YES' : 'NO'}`);
      console.log(`   Cache effectiveness: ${(routeResult.cacheEffectiveness * 100).toFixed(1)}%`);
      
      if (routeResult.issues.length > 0) {
        console.log(`   ⚠️  Issues: ${routeResult.issues.join(', ')}`);
      }
    }
    
    return this.compileBaselineMetrics(results, iterations);
  }

  /**
   * Measure performance of a single request to a route
   */
  private async measureSingleRequest(route: RouteTestConfig): Promise<RequestMeasurement> {
    const startTime = Date.now();
    
    try {
      // Make request to local dev server
      const response = await fetch(`${this.serverUrl}${route.path}`, {
        method: route.method,
        headers: {
          ...route.headers,
          ...(this.authCookie ? { 'Cookie': this.authCookie } : {}),
          'User-Agent': 'Wave0-Baseline-Measurement/1.0'
        },
        body: route.body ? JSON.stringify(route.body) : undefined
      });
      
      const endTime = Date.now();
      const totalLatency = endTime - startTime;
      
      // Extract performance headers if available (from our enhanced middleware)
      const authCallCount = parseInt(response.headers.get('x-auth-calls') || '0');
      const duplicateCalls = parseInt(response.headers.get('x-duplicate-calls') || '0');
      const requestDuration = parseInt(response.headers.get('x-request-duration') || totalLatency.toString());
      
      // Get metrics from instrumentation module
      const metrics = getAuthMetrics();
      
      // Get tracker metrics for more detailed analysis
      const trackerMetrics = globalRequestTracker.getAggregatedMetrics();
      
      return {
        statusCode: response.status,
        totalLatency: requestDuration,
        authCallCount: authCallCount || metrics.totalResolverCalls,
        duplicateCalls: duplicateCalls,
        cacheHitRate: trackerMetrics.averageCacheHitRate || 0,
        resolverBreakdown: metrics.resolverBreakdown,
        headers: {
          'x-auth-calls': response.headers.get('x-auth-calls') || 'N/A',
          'x-request-duration': response.headers.get('x-request-duration') || 'N/A',
          'x-duplicate-calls': response.headers.get('x-duplicate-calls') || 'N/A',
        }
      };
    } catch (error) {
      console.error(`Error measuring ${route.path}:`, error);
      return {
        statusCode: 0,
        totalLatency: 0,
        authCallCount: 0,
        duplicateCalls: 0,
        cacheHitRate: 0,
        resolverBreakdown: {},
        headers: {}
      };
    }
  }

  /**
   * Analyze measurements for a single route
   */
  private analyzeRouteMeasurements(route: RouteTestConfig, measurements: RequestMeasurement[]): RouteTestResult {
    const validMeasurements = measurements.filter(m => m.statusCode === 200);
    
    if (validMeasurements.length === 0) {
      return {
        route: route.name,
        path: route.path,
        measurements,
        averageAuthCalls: 0,
        averageLatency: 0,
        duplicateCallsDetected: false,
        cacheEffectiveness: 0,
        issues: ['All requests failed']
      };
    }

    const averageAuthCalls = validMeasurements.reduce((sum, m) => sum + m.authCallCount, 0) / validMeasurements.length;
    const averageLatency = validMeasurements.reduce((sum, m) => sum + m.totalLatency, 0) / validMeasurements.length;
    const duplicateCallsDetected = validMeasurements.some(m => m.duplicateCalls > 0);
    const cacheEffectiveness = validMeasurements.reduce((sum, m) => sum + m.cacheHitRate, 0) / validMeasurements.length;

    // Identify issues
    const issues: string[] = [];
    if (averageAuthCalls > route.expectedAuthCalls * 1.5) {
      issues.push(`High auth call count: ${averageAuthCalls.toFixed(2)} (expected ~${route.expectedAuthCalls})`);
    }
    if (duplicateCallsDetected) {
      issues.push(`Duplicate auth calls detected`);
    }
    if (cacheEffectiveness < 0.7) {
      issues.push(`Low cache effectiveness: ${(cacheEffectiveness * 100).toFixed(1)}%`);
    }
    if (averageLatency > 1000) {
      issues.push(`High latency: ${averageLatency.toFixed(0)}ms`);
    }
    if (validMeasurements.length < measurements.length) {
      issues.push(`${measurements.length - validMeasurements.length} failed requests`);
    }

    return {
      route: route.name,
      path: route.path,
      measurements,
      averageAuthCalls,
      averageLatency: Math.round(averageLatency),
      duplicateCallsDetected,
      cacheEffectiveness,
      issues
    };
  }

  /**
   * Compile comprehensive baseline metrics
   */
  private compileBaselineMetrics(results: RouteTestResult[], iterations: number): BaselineMetrics {
    const totalRequests = results.reduce((sum, r) => sum + r.measurements.filter(m => m.statusCode === 200).length, 0);
    const totalAuthCalls = results.reduce((sum, r) => sum + (r.averageAuthCalls * r.measurements.filter(m => m.statusCode === 200).length), 0);
    const totalDuplicateCalls = results.reduce((sum, r) => sum + r.measurements.reduce((rSum, m) => rSum + m.duplicateCalls, 0), 0);
    const totalLatency = results.reduce((sum, r) => sum + (r.averageLatency * r.measurements.filter(m => m.statusCode === 200).length), 0);
    const totalCacheRate = results.reduce((sum, r) => sum + (r.cacheEffectiveness * r.measurements.filter(m => m.statusCode === 200).length), 0);

    const averageAuthCallsPerRequest = totalRequests > 0 ? totalAuthCalls / totalRequests : 0;
    const averageRequestLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;
    const averageCacheHitRate = totalRequests > 0 ? totalCacheRate / totalRequests : 0;

    const problemRoutes = results.filter(r => r.issues.length > 0).map(r => r.route);

    return {
      measurementDate: new Date().toISOString(),
      testConfiguration: {
        iterations,
        testRoutes: CORE_ROUTES.length,
        serverUrl: this.serverUrl
      },
      routes: results,
      summary: {
        totalRequests,
        averageAuthCallsPerRequest,
        totalDuplicateCalls,
        averageCacheHitRate,
        averageRequestLatency,
        problemRoutes
      },
      targetAnalysis: {
        authResolutionsPerRequestTarget: 1.0,
        authResolutionsPerRequestActual: averageAuthCallsPerRequest,
        duplicateQueryTarget: 0,
        duplicateQueryActual: totalDuplicateCalls,
        cacheHitRateTarget: 0.8,
        cacheHitRateActual: averageCacheHitRate
      }
    };
  }

  /**
   * Verify development server is available
   */
  private async verifyServerAvailable(): Promise<void> {
    try {
      console.log(`🔍 Verifying server availability at ${this.serverUrl}...`);
      const response = await fetch(`${this.serverUrl}/api/health`);
      if (response.ok) {
        console.log('✅ Server is available');
        return;
      }
      
      // Try a simple route if health endpoint doesn't exist
      const fallbackResponse = await fetch(this.serverUrl);
      if (fallbackResponse.status < 500) {
        console.log('✅ Server is available (via fallback check)');
        return;
      }
      
      throw new Error(`Server returned ${fallbackResponse.status}`);
    } catch (error) {
      console.error('❌ Server not available:', error);
      throw new Error('Development server not available. Please run: npm run dev');
    }
  }

  /**
   * Setup authentication for testing authenticated routes
   */
  private async setupAuthentication(): Promise<void> {
    // For now, we'll test without authentication and note this limitation
    // In a real scenario, we'd either:
    // 1. Use a test user's session cookie
    // 2. Create a test authentication endpoint
    // 3. Use a development-only auth bypass
    
    console.log('⚠️  Note: Testing without authentication - some routes may return auth errors');
    console.log('   This is expected for the baseline measurement');
    
    // TODO: Implement proper test authentication setup
    // This could involve reading a test session cookie or using a test auth endpoint
  }

  /**
   * Sleep utility for pacing requests
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Export results to JSON file
   */
  async exportResults(results: BaselineMetrics, filename: string = 'auth-performance-baseline.json'): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(filename, JSON.stringify(results, null, 2));
    console.log(`📊 Results exported to ${filename}`);
  }
}

// CLI interface when run directly
if (import.meta.main) {
  const tester = new AuthPerformanceTester();
  
  try {
    const results = await tester.measureBaselinePerformance(10);
    
    console.log('\n📈 BASELINE MEASUREMENT SUMMARY');
    console.log('================================');
    console.log(`Target auth calls per request: ${results.targetAnalysis.authResolutionsPerRequestTarget}`);
    console.log(`Actual auth calls per request: ${results.targetAnalysis.authResolutionsPerRequestActual.toFixed(2)}`);
    console.log(`Target duplicate calls: ${results.targetAnalysis.duplicateQueryTarget}`);
    console.log(`Actual duplicate calls: ${results.targetAnalysis.duplicateQueryActual}`);
    console.log(`Target cache hit rate: ${(results.targetAnalysis.cacheHitRateTarget * 100)}%`);
    console.log(`Actual cache hit rate: ${(results.targetAnalysis.cacheHitRateActual * 100).toFixed(1)}%`);
    console.log(`Average request latency: ${results.summary.averageRequestLatency.toFixed(0)}ms`);
    
    if (results.summary.problemRoutes.length > 0) {
      console.log(`\n⚠️  Routes with issues: ${results.summary.problemRoutes.join(', ')}`);
    }
    
    await tester.exportResults(results);
    
  } catch (error) {
    console.error('❌ Measurement failed:', error);
    process.exit(1);
  }
}