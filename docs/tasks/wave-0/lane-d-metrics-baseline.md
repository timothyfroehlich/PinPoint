# Lane D: Metrics Baseline - Wave 0 Task File

**Agent:** Lane D Specialist  
**Duration:** 1-2 days  
**Status:** READY FOR EXECUTION  

## Mission

Establish baseline performance metrics for authentication resolution patterns before any migration begins. Create measurement infrastructure to track auth resolver calls per request, detect duplicate queries, and measure the performance impact of authentication context resolution across the PinPoint application.

## Context & Current State

PinPoint has basic authentication instrumentation ready for expansion:

### Existing Instrumentation Infrastructure
- **Metrics Module**: `src/lib/auth/instrumentation.ts` - Basic call tracking
- **Metrics API**: `src/app/api/_internal/auth-metrics/route.ts` - HTTP endpoint for metrics  
- **Observability Logger**: `src/server/observability/logger.ts` - Structured logging
- **Canonical Resolver**: `src/server/auth/context.ts` - Single source of truth (target pattern)

### Current Metrics Capabilities
```typescript
// From src/lib/auth/instrumentation.ts
interface AuthMetrics {
  resolverCalls: Map<string, number>;
  requestCount: number; 
  lastReset: number;
}

// Available functions:
trackAuthResolverCall(functionName: string, stackSignature?: string): void
trackRequest(): void
getAuthMetrics(): AuthMetricsResult
resetAuthMetrics(): void
```

### Key Performance Indicators (Target)
From Wave 0 specification:
- **`auth_resolutions_per_request = 1.0`** (ideal: single auth resolution per request)
- **Duplicate query detection** (should be 0)
- **Total role conditionals count** (baseline measurement)
- **Authentication latency** (request overhead from auth resolution)

### Architecture Context

**Current Auth Resolution Patterns:**
1. **Canonical**: `getRequestAuthContext()` - NEW, cached, single resolution
2. **Legacy**: `requireMemberAccess()` - OLD, heavily used (7+ files)  
3. **DAL**: `ensureOrgContextAndBindRLS()` - OLD, database-scoped
4. **Supabase**: Various SSR helpers - Integration layer

**Key Routes for Testing:**
- Dashboard: `src/app/dashboard/page.tsx`
- Issues: `src/app/issues/page.tsx` 
- Machines: `src/app/machines/page.tsx`
- Settings: `src/app/settings/*/page.tsx`
- API Search: `src/app/api/search/*/route.ts`

## Deliverables

### 1. Enhanced Metrics Collection

#### A. Extended Instrumentation Module
**File**: `src/lib/auth/instrumentation.ts` (enhance existing)

```typescript
// Add to existing interface
interface AuthMetrics {
  resolverCalls: Map<string, number>;
  requestCount: number;
  lastReset: number;
  // NEW METRICS:
  requestLatency: number[]; // Auth resolution timing
  duplicateCallPatterns: Map<string, number>; // Same request, multiple auth calls
  cacheHitRate: number; // cache() effectiveness
  routeBreakdown: Map<string, RouteMetrics>; // Per-route analysis
}

interface RouteMetrics {
  authCallCount: number;
  averageLatency: number;
  cacheHits: number;
  cacheMisses: number;
  duplicateCalls: number;
}

// NEW FUNCTIONS:
export function startRequestTimer(requestId: string): void;
export function endRequestTimer(requestId: string): void;
export function trackDuplicateAuthCall(requestId: string, functionName: string): void;
export function trackCacheEvent(requestId: string, eventType: 'hit' | 'miss'): void;
export function getRouteMetrics(route: string): RouteMetrics;
export function exportMetricsSnapshot(): MetricsSnapshot;
```

#### B. Request-Scoped Tracking
**File**: `src/lib/auth/request-tracker.ts` (new)

```typescript
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

export class RequestTracker {
  private activeRequests = new Map<string, RequestContext>();
  
  startRequest(route: string): string {
    const requestId = generateRequestId();
    this.activeRequests.set(requestId, {
      id: requestId,
      route,
      startTime: Date.now(),
      authCalls: [],
      cacheEvents: []
    });
    return requestId;
  }
  
  trackAuthCall(requestId: string, functionName: string): void {
    const context = this.activeRequests.get(requestId);
    if (!context) return;
    
    const authCall: AuthCall = {
      function: functionName,
      timestamp: Date.now(),
      duration: 0, // Will be updated on completion
      stackTrace: getStackSignature(),
      isDuplicate: this.isDuplicateCall(context, functionName)
    };
    
    context.authCalls.push(authCall);
    
    if (authCall.isDuplicate) {
      trackDuplicateAuthCall(requestId, functionName);
    }
  }
  
  endRequest(requestId: string): RequestSummary {
    const context = this.activeRequests.get(requestId);
    if (!context) throw new Error('Request not found');
    
    const summary: RequestSummary = {
      requestId,
      route: context.route,
      totalDuration: Date.now() - context.startTime,
      authCallCount: context.authCalls.length,
      duplicateCallCount: context.authCalls.filter(call => call.isDuplicate).length,
      authResolutionsPerRequest: context.authCalls.length,
      cacheHitRate: this.calculateCacheHitRate(context)
    };
    
    this.activeRequests.delete(requestId);
    return summary;
  }
}
```

#### C. Middleware Integration
**File**: `middleware.ts` (enhance existing)

```typescript
import { RequestTracker } from '~/lib/auth/request-tracker';

const requestTracker = new RequestTracker();

export async function middleware(request: NextRequest) {
  const route = request.nextUrl.pathname;
  const requestId = requestTracker.startRequest(route);
  
  // Store request ID for downstream usage
  const requestWithId = request.clone();
  requestWithId.headers.set('x-request-id', requestId);
  
  const response = await next();
  
  // Capture metrics before response
  const summary = requestTracker.endRequest(requestId);
  
  // Log performance if concerning
  if (summary.authResolutionsPerRequest > 2) {
    console.warn(`[METRICS] High auth resolution count: ${summary.authResolutionsPerRequest} for ${route}`);
  }
  
  return response;
}
```

### 2. Baseline Measurement Scripts

#### A. Route Testing Script
**File**: `scripts/baseline/measure-auth-performance.ts`

```typescript
interface RouteTestConfig {
  name: string;
  path: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: unknown;
  expectedAuthCalls: number; // Expected number for validation
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
  }
];

export class AuthPerformanceTester {
  async measureBaselinePerformance(): Promise<BaselineMetrics> {
    console.log('🔍 Starting baseline auth performance measurement...');
    
    const results: RouteTestResult[] = [];
    
    for (const route of CORE_ROUTES) {
      console.log(`Testing ${route.name} (${route.path})...`);
      
      // Reset metrics for clean measurement
      resetAuthMetrics();
      
      // Make 10 requests to get average
      const measurements: RequestMeasurement[] = [];
      
      for (let i = 0; i < 10; i++) {
        const measurement = await this.measureSingleRequest(route);
        measurements.push(measurement);
      }
      
      const routeResult: RouteTestResult = {
        route: route.name,
        path: route.path,
        measurements,
        averageAuthCalls: measurements.reduce((sum, m) => sum + m.authCallCount, 0) / measurements.length,
        averageLatency: measurements.reduce((sum, m) => sum + m.totalLatency, 0) / measurements.length,
        duplicateCallsDetected: measurements.some(m => m.duplicateCalls > 0),
        cacheEffectiveness: measurements.reduce((sum, m) => sum + m.cacheHitRate, 0) / measurements.length
      };
      
      results.push(routeResult);
    }
    
    return this.compileBaselineMetrics(results);
  }
  
  private async measureSingleRequest(route: RouteTestConfig): Promise<RequestMeasurement> {
    const startTime = Date.now();
    
    // Make request to local dev server
    const response = await fetch(`http://localhost:3000${route.path}`, {
      method: route.method,
      headers: {
        ...route.headers,
        'Cookie': await this.getAuthCookie() // Need valid session
      },
      body: route.body ? JSON.stringify(route.body) : undefined
    });
    
    const endTime = Date.now();
    
    // Get metrics from instrumentation  
    const metrics = getAuthMetrics();
    
    return {
      statusCode: response.status,
      totalLatency: endTime - startTime,
      authCallCount: metrics.totalResolverCalls,
      duplicateCalls: this.countDuplicateCalls(metrics),
      cacheHitRate: this.calculateCacheHitRate(metrics),
      resolverBreakdown: metrics.resolverBreakdown
    };
  }
}
```

#### B. Automated Baseline Runner
**File**: `scripts/baseline/run-baseline-measurement.ts`

```typescript
interface BaselineConfig {
  iterations: number;
  warmupRequests: number;
  includeSlowRoutes: boolean;
  outputFormat: 'json' | 'markdown' | 'csv';
}

export class BaselineRunner {
  async executeFullBaseline(config: BaselineConfig): Promise<void> {
    console.log('🚀 Starting comprehensive baseline measurement...');
    
    // 1. Verify development server is running
    await this.verifyServerAvailable();
    
    // 2. Warm up the application
    await this.performWarmupRequests(config.warmupRequests);
    
    // 3. Run core route measurements
    const coreMetrics = await this.measureCoreRoutes(config.iterations);
    
    // 4. Run API endpoint measurements  
    const apiMetrics = await this.measureApiEndpoints(config.iterations);
    
    // 5. Measure authentication function usage patterns
    const authPatterns = await this.measureAuthPatterns();
    
    // 6. Compile comprehensive baseline
    const baseline: ComprehensiveBaseline = {
      measurementDate: new Date().toISOString(),
      configuration: config,
      coreRoutes: coreMetrics,
      apiEndpoints: apiMetrics,
      authPatterns: authPatterns,
      summary: this.generateSummary(coreMetrics, apiMetrics, authPatterns)
    };
    
    // 7. Export in requested format(s)
    await this.exportBaseline(baseline, config.outputFormat);
    
    console.log('✅ Baseline measurement complete!');
    this.printSummary(baseline.summary);
  }
  
  private async verifyServerAvailable(): Promise<void> {
    try {
      const response = await fetch('http://localhost:3000/api/health');
      if (!response.ok) throw new Error('Server not healthy');
    } catch (error) {
      throw new Error('Development server not available. Run: npm run dev');
    }
  }
}
```

### 3. Metrics Snapshots & Analysis

#### A. Baseline Snapshot Format
**File**: `docs/baseline/metrics-initial.json`

```json
{
  "baselineDate": "2025-01-XX",
  "measurementConfig": {
    "iterations": 10,
    "warmupRequests": 5,
    "routesCovered": 15
  },
  "targetMetrics": {
    "authResolutionsPerRequest": {
      "target": 1.0,
      "current": 2.3,
      "deviation": 130,
      "status": "needs-improvement"
    },
    "duplicateQueryDetection": {
      "target": 0,
      "current": 12,
      "status": "failing"
    },
    "totalRoleConditionals": {
      "baseline": 47,
      "description": "Total role checks across codebase"
    }
  },
  "routeBreakdown": [
    {
      "route": "/dashboard",
      "averageAuthCalls": 1.8,
      "averageLatency": 145,
      "duplicateCallsDetected": true,
      "cacheEffectiveness": 0.72,
      "issues": [
        "Multiple requireMemberAccess calls detected",
        "Cache hit rate below 80%"
      ]
    },
    {
      "route": "/issues",
      "averageAuthCalls": 3.1, 
      "averageLatency": 203,
      "duplicateCallsDetected": true,
      "cacheEffectiveness": 0.45,
      "issues": [
        "High auth call count - investigate",
        "Poor cache effectiveness"  
      ]
    }
  ],
  "authPatternAnalysis": {
    "mostUsedFunction": "requireMemberAccess",
    "usageBreakdown": {
      "requireMemberAccess": 67,
      "getOrganizationContext": 23,
      "ensureOrgContextAndBindRLS": 18,
      "getRequestAuthContext": 2
    },
    "duplicateCallPatterns": [
      {
        "pattern": "requireMemberAccess + getOrganizationContext",
        "occurrences": 12,
        "routes": ["/dashboard", "/machines", "/settings/users"]
      }
    ]
  },
  "performance": {
    "averageAuthLatency": 89,
    "p95AuthLatency": 156,
    "slowestRoute": "/settings/activity",
    "fastestRoute": "/api/search/suggestions",
    "cacheOverallHitRate": 0.61
  },
  "recommendations": [
    "Migrate requireMemberAccess calls to getRequestAuthContext",
    "Investigate duplicate auth calls in /issues route",
    "Improve cache() wrapper usage for better hit rates",
    "Consider request-level auth context caching"
  ]
}
```

#### B. Metrics Analysis & Reporting
**File**: `scripts/baseline/analyze-metrics.ts`

```typescript
interface MetricsAnalysis {
  healthScore: number; // 0-100
  criticalIssues: Issue[];
  recommendations: Recommendation[];
  trendAnalysis: TrendData;
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'performance' | 'duplication' | 'caching' | 'patterns';
  description: string;
  affectedRoutes: string[];
  estimatedImpact: string;
}

export class MetricsAnalyzer {
  analyzeBaseline(baseline: ComprehensiveBaseline): MetricsAnalysis {
    const issues: Issue[] = [];
    
    // Detect critical performance issues
    if (baseline.targetMetrics.authResolutionsPerRequest.current > 2.0) {
      issues.push({
        severity: 'critical',
        category: 'performance', 
        description: `Auth resolutions per request (${baseline.targetMetrics.authResolutionsPerRequest.current}) significantly exceeds target (1.0)`,
        affectedRoutes: this.getHighAuthCallRoutes(baseline),
        estimatedImpact: 'High latency and resource usage'
      });
    }
    
    // Detect duplicate query patterns
    if (baseline.targetMetrics.duplicateQueryDetection.current > 0) {
      issues.push({
        severity: 'high',
        category: 'duplication',
        description: `${baseline.targetMetrics.duplicateQueryDetection.current} duplicate auth queries detected`,
        affectedRoutes: this.getDuplicateCallRoutes(baseline),
        estimatedImpact: 'Unnecessary database load and latency'
      });
    }
    
    // Analyze cache effectiveness
    const avgCacheHitRate = baseline.performance.cacheOverallHitRate;
    if (avgCacheHitRate < 0.7) {
      issues.push({
        severity: 'medium',
        category: 'caching',
        description: `Cache hit rate (${avgCacheHitRate.toFixed(2)}) below optimal threshold (0.8)`,
        affectedRoutes: this.getLowCacheRoutes(baseline),
        estimatedImpact: 'Increased server load and response times'
      });
    }
    
    return {
      healthScore: this.calculateHealthScore(baseline, issues),
      criticalIssues: issues.filter(i => i.severity === 'critical'),
      recommendations: this.generateRecommendations(baseline, issues),
      trendAnalysis: this.analyzeTrends(baseline)
    };
  }
  
  private calculateHealthScore(baseline: ComprehensiveBaseline, issues: Issue[]): number {
    let score = 100;
    
    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': score -= 30; break;
        case 'high': score -= 20; break; 
        case 'medium': score -= 10; break;
        case 'low': score -= 5; break;
      }
    });
    
    return Math.max(0, score);
  }
  
  generateReport(analysis: MetricsAnalysis): string {
    const report = [
      '=== PinPoint Authentication Performance Baseline ===',
      `Health Score: ${analysis.healthScore}/100`,
      '',
      'Critical Issues:',
      ...analysis.criticalIssues.map(issue => `❌ ${issue.description}`),
      '',
      'Top Recommendations:',
      ...analysis.recommendations.slice(0, 5).map((rec, i) => `${i + 1}. ${rec.description}`),
      '',
      'Trend Analysis:',
      `Auth Call Trend: ${analysis.trendAnalysis.authCallTrend}`,
      `Performance Trend: ${analysis.trendAnalysis.performanceTrend}`
    ];
    
    return report.join('\n');
  }
}
```

### 4. Continuous Monitoring Infrastructure

#### A. Metrics Dashboard API Enhancement
**File**: `src/app/api/_internal/auth-metrics/route.ts` (enhance existing)

```typescript
// Add to existing API
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'json';
  const timeRange = url.searchParams.get('range') || '1h';
  
  const metrics = getAuthMetrics();
  const analysis = new MetricsAnalyzer().analyzeBaseline({
    // Convert current metrics to baseline format
  });
  
  if (format === 'prometheus') {
    return new Response(formatAsPrometheus(metrics), {
      headers: { 'Content-Type': 'text/plain' }
    });
  }
  
  return new Response(JSON.stringify({
    timestamp: new Date().toISOString(),
    metrics,
    analysis: analysis.healthScore < 70 ? analysis : undefined, // Only include if concerning
    alerts: analysis.criticalIssues.length > 0 ? analysis.criticalIssues : undefined
  }));
}

function formatAsPrometheus(metrics: AuthMetricsResult): string {
  return [
    `# HELP auth_resolutions_per_request Authentication resolutions per HTTP request`,
    `# TYPE auth_resolutions_per_request gauge`,
    `auth_resolutions_per_request ${metrics.authResolutionsPerRequest}`,
    '',
    `# HELP auth_resolver_calls_total Total authentication resolver calls`,
    `# TYPE auth_resolver_calls_total counter`, 
    `auth_resolver_calls_total ${metrics.totalResolverCalls}`,
    '',
    `# HELP auth_cache_hit_rate Authentication context cache hit rate`,
    `# TYPE auth_cache_hit_rate gauge`,
    `auth_cache_hit_rate ${metrics.cacheHitRate || 0}`
  ].join('\n');
}
```

#### B. Alerting & Threshold Monitoring
**File**: `scripts/monitoring/auth-alert-checker.ts`

```typescript
interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  severity: 'critical' | 'warning';
  description: string;
}

const ALERT_THRESHOLDS: AlertThreshold[] = [
  {
    metric: 'authResolutionsPerRequest',
    operator: 'gt',
    value: 3.0,
    severity: 'critical',
    description: 'Excessive auth resolutions per request'
  },
  {
    metric: 'duplicateCallCount',
    operator: 'gt', 
    value: 0,
    severity: 'warning',
    description: 'Duplicate authentication calls detected'
  },
  {
    metric: 'cacheHitRate',
    operator: 'lt',
    value: 0.6,
    severity: 'warning',
    description: 'Low authentication cache hit rate'
  }
];

export class AuthAlertChecker {
  async checkThresholds(): Promise<Alert[]> {
    const metrics = getAuthMetrics();
    const alerts: Alert[] = [];
    
    for (const threshold of ALERT_THRESHOLDS) {
      const value = metrics[threshold.metric as keyof typeof metrics];
      const triggered = this.evaluateThreshold(value, threshold);
      
      if (triggered) {
        alerts.push({
          metric: threshold.metric,
          currentValue: value,
          threshold: threshold.value,
          severity: threshold.severity,
          description: threshold.description,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return alerts;
  }
  
  async monitorContinuous(intervalSeconds: number): Promise<void> {
    setInterval(async () => {
      const alerts = await this.checkThresholds();
      
      if (alerts.length > 0) {
        console.warn('[AUTH-MONITORING] Threshold alerts:', alerts);
        
        // Could integrate with external monitoring (Sentry, DataDog, etc.)
        alerts.forEach(alert => {
          if (alert.severity === 'critical') {
            console.error(`🚨 CRITICAL: ${alert.description} (${alert.currentValue})`);
          }
        });
      }
    }, intervalSeconds * 1000);
  }
}
```

## Implementation Phases

### Phase 1: Core Instrumentation Enhancement (Day 1)
1. **Extend existing metrics module** with latency and duplicate call tracking
2. **Add request-scoped tracking** for per-request analysis
3. **Enhance middleware integration** for automatic measurement
4. **Test instrumentation** with manual requests to verify data collection

### Phase 2: Baseline Measurement Execution (Day 1-2)
1. **Create route testing script** with comprehensive coverage
2. **Run baseline measurement** across all core routes
3. **Generate initial metrics snapshot** in JSON format
4. **Analyze results** and identify critical performance issues

### Phase 3: Monitoring & Analysis Infrastructure (Day 2)  
1. **Enhance metrics API** with analysis and alerting
2. **Create analysis scripts** for health scoring and recommendations
3. **Set up continuous monitoring** with threshold alerts
4. **Document baseline** for comparison with future measurements

## Integration with Other Lanes

### Support Lane A (Inventory)
- **Cross-reference usage counts** with actual runtime metrics
- **Validate function inventory** against observed call patterns
- **Identify discrepancies** between static analysis and runtime behavior

### Coordinate with Lane B (ESLint)
- **Measure ESLint rule effectiveness** via metrics before/after enforcement
- **Provide data** to inform ESLint rule thresholds and severity
- **Track compliance** with performance-related rules

### Prepare for Lane C (Codemods)
- **Establish baseline** before codemods execute transformations
- **Provide target metrics** for measuring codemod success
- **Create comparison framework** for before/after analysis

## Success Criteria & Validation

### Wave 0 Success Criteria  
✅ **Enhanced Instrumentation**: Request-scoped auth call tracking works  
✅ **Baseline Metrics Captured**: Complete snapshot of current performance  
✅ **Critical Issues Identified**: Auth resolution inefficiencies documented  
✅ **Monitoring Infrastructure**: Continuous measurement capability established  
✅ **Analysis Framework**: Health scoring and recommendation system operational  

### Key Metrics Baselines (Expected Ranges)
- **`auth_resolutions_per_request`**: Currently 2.0-3.5, target 1.0
- **Duplicate calls**: Currently 10-25 per 100 requests, target 0  
- **Cache hit rate**: Currently 40-70%, target 80%+
- **Auth latency**: Currently 50-200ms, target <50ms

### Validation Tests
```bash
# Test 1: Instrumentation accuracy
curl -H "Cookie: auth-cookie" http://localhost:3000/dashboard
curl http://localhost:3000/api/_internal/auth-metrics
# Should show tracked metrics for the request

# Test 2: Baseline measurement  
npm run baseline:measure-auth-performance
# Should generate docs/baseline/metrics-initial.json

# Test 3: Analysis functionality
npm run baseline:analyze-metrics
# Should generate health score and recommendations

# Test 4: Continuous monitoring
npm run monitoring:start-auth-alerts
# Should monitor and alert on threshold violations
```

## Risk Mitigation

### Major Risks
- **Instrumentation Overhead** - Metrics collection impacts performance
- **False Measurements** - Development vs production behavior differences
- **Data Accuracy** - Timing measurements affected by system load
- **Baseline Drift** - Metrics change due to development activity

### Mitigation Strategies
- **Lightweight Tracking** - Minimal performance impact instrumentation
- **Multiple Measurement Runs** - Average results for stability
- **System Load Awareness** - Measure during consistent conditions  
- **Snapshot Versioning** - Track measurement context and conditions

## Dependencies & Prerequisites  

### Required Understanding
- **Existing instrumentation**: `src/lib/auth/instrumentation.ts`
- **Current auth patterns**: Lane A inventory results
- **Performance requirements**: Wave 0 specification targets
- **Route structure**: `src/app/` directory architecture

### Development Environment
```bash
# Verify dev server is running and accessible
curl http://localhost:3000/api/health

# Verify authentication works (need valid session)
# Check existing metrics endpoint
curl http://localhost:3000/api/_internal/auth-metrics

# Install additional measurement dependencies if needed
npm install --save-dev performance-now clinic
```

### Authentication Setup for Testing
You'll need valid authentication context for meaningful measurements:
1. **Sign in to development server** via `/auth/sign-in`
2. **Extract session cookie** for programmatic requests  
3. **Verify organization context** is available
4. **Test authenticated routes** return expected data

Your baseline measurements will establish the performance foundation that guides all subsequent optimization efforts throughout the authentication modernization project.
