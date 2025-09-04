/**
 * Wave 0 Baseline Measurement Runner
 * Comprehensive orchestration for authentication performance baseline capture
 */

import { AuthPerformanceTester } from './measure-auth-performance';
import { exportMetricsSnapshot } from '~/lib/auth/instrumentation';

interface BaselineConfig {
  iterations: number;
  warmupRequests: number;
  includeSlowRoutes: boolean;
  outputFormat: 'json' | 'markdown' | 'csv';
  serverUrl?: string;
  outputDir?: string;
}

interface ComprehensiveBaseline {
  measurementDate: string;
  configuration: BaselineConfig;
  coreRoutes: BaselineMetrics;
  apiEndpoints: BaselineMetrics;
  authPatterns: AuthPatternAnalysis;
  summary: BaselineSummary;
}

interface AuthPatternAnalysis {
  mostUsedFunction: string;
  usageBreakdown: Record<string, number>;
  duplicateCallPatterns: Array<{
    pattern: string;
    occurrences: number;
    routes: string[];
  }>;
  problemPatterns: string[];
}

interface BaselineSummary {
  healthScore: number; // 0-100
  criticalIssues: string[];
  recommendations: string[];
  targetComparison: {
    authCallsPerRequest: { target: number; actual: number; status: 'good' | 'warning' | 'critical' };
    duplicateCalls: { target: number; actual: number; status: 'good' | 'warning' | 'critical' };
    cacheHitRate: { target: number; actual: number; status: 'good' | 'warning' | 'critical' };
    averageLatency: { target: number; actual: number; status: 'good' | 'warning' | 'critical' };
  };
}

export class BaselineRunner {
  private config: BaselineConfig;
  private tester: AuthPerformanceTester;

  constructor(config: Partial<BaselineConfig> = {}) {
    this.config = {
      iterations: 10,
      warmupRequests: 3,
      includeSlowRoutes: true,
      outputFormat: 'json',
      serverUrl: 'http://localhost:3000',
      outputDir: './docs/baseline',
      ...config
    };
    
    this.tester = new AuthPerformanceTester(this.config.serverUrl);
  }

  /**
   * Execute full baseline measurement suite
   */
  async executeFullBaseline(): Promise<ComprehensiveBaseline> {
    console.log('🚀 Starting Wave 0 comprehensive baseline measurement...');
    console.log(`Configuration:`, {
      iterations: this.config.iterations,
      warmupRequests: this.config.warmupRequests,
      serverUrl: this.config.serverUrl,
      outputFormat: this.config.outputFormat
    });

    // Phase 1: Verify environment
    console.log('\n📋 Phase 1: Environment verification');
    await this.verifyEnvironment();

    // Phase 2: Warmup
    console.log('\n🔥 Phase 2: Application warmup');
    await this.performWarmupRequests();

    // Phase 3: Core route measurements
    console.log('\n📊 Phase 3: Core route measurements');
    const coreMetrics = await this.measureCoreRoutes();

    // Phase 4: API endpoint measurements
    console.log('\n🔌 Phase 4: API endpoint measurements');
    const apiMetrics = await this.measureApiEndpoints();

    // Phase 5: Auth pattern analysis
    console.log('\n🔍 Phase 5: Authentication pattern analysis');
    const authPatterns = await this.analyzeAuthPatterns();

    // Phase 6: Comprehensive analysis
    console.log('\n📈 Phase 6: Comprehensive analysis');
    const summary = this.generateSummary(coreMetrics, apiMetrics, authPatterns);

    const baseline: ComprehensiveBaseline = {
      measurementDate: new Date().toISOString(),
      configuration: this.config,
      coreRoutes: coreMetrics,
      apiEndpoints: apiMetrics,
      authPatterns,
      summary
    };

    // Phase 7: Export results
    console.log('\n💾 Phase 7: Export results');
    await this.exportBaseline(baseline);

    console.log('\n✅ Baseline measurement complete!');
    this.printSummaryReport(baseline.summary);

    return baseline;
  }

  /**
   * Verify development environment is ready
   */
  private async verifyEnvironment(): Promise<void> {
    // Check server availability
    try {
      const response = await fetch(`${this.config.serverUrl}/api/health`);
      if (!response.ok) {
        // Try basic server check
        const basicResponse = await fetch(this.config.serverUrl);
        if (basicResponse.status >= 500) {
          throw new Error(`Server error: ${basicResponse.status}`);
        }
      }
      console.log('✅ Development server is available');
    } catch (error) {
      throw new Error(`Development server not available at ${this.config.serverUrl}. Please run: npm run dev`);
    }

    // Check output directory
    try {
      const fs = await import('fs/promises');
      await fs.mkdir(this.config.outputDir!, { recursive: true });
      console.log(`✅ Output directory ready: ${this.config.outputDir}`);
    } catch (error) {
      console.warn(`⚠️  Could not create output directory: ${error}`);
    }

    // Check Node.js modules
    try {
      await import('~/lib/auth/instrumentation');
      await import('~/lib/auth/request-tracker');
      console.log('✅ Instrumentation modules available');
    } catch (error) {
      throw new Error(`Required modules not available: ${error}`);
    }
  }

  /**
   * Perform warmup requests to stabilize performance
   */
  private async performWarmupRequests(): Promise<void> {
    console.log(`Warming up with ${this.config.warmupRequests} requests...`);
    
    const warmupRoutes = ['/dashboard', '/issues', '/machines'];
    
    for (let i = 0; i < this.config.warmupRequests; i++) {
      for (const route of warmupRoutes) {
        try {
          await fetch(`${this.config.serverUrl}${route}`, {
            headers: { 'User-Agent': 'Wave0-Warmup/1.0' }
          });
        } catch (error) {
          // Warmup failures are non-fatal
          console.warn(`Warmup request failed for ${route}:`, error instanceof Error ? error.message : error);
        }
        
        // Small delay between warmup requests
        await this.sleep(50);
      }
    }
    
    console.log('✅ Warmup complete');
    await this.sleep(1000); // Let things settle
  }

  /**
   * Measure core application routes
   */
  private async measureCoreRoutes(): Promise<BaselineMetrics> {
    console.log(`Measuring core routes with ${this.config.iterations} iterations each...`);
    
    const metrics = await this.tester.measureBaselinePerformance(this.config.iterations);
    
    console.log(`✅ Core routes measured: ${metrics.routes.length} routes, ${metrics.summary.totalRequests} total requests`);
    
    return metrics;
  }

  /**
   * Measure API endpoints specifically
   */
  private async measureApiEndpoints(): Promise<BaselineMetrics> {
    console.log('Measuring API endpoints...');
    
    // For now, API measurement is included in the core measurement
    // In a more sophisticated setup, we could have separate API-only tests
    const coreMetrics = await this.tester.measureBaselinePerformance(this.config.iterations);
    
    // Filter to API routes only
    const apiRoutes = coreMetrics.routes.filter(route => route.path.startsWith('/api'));
    
    const apiMetrics: BaselineMetrics = {
      ...coreMetrics,
      routes: apiRoutes,
      summary: {
        ...coreMetrics.summary,
        totalRequests: apiRoutes.reduce((sum, route) => sum + route.measurements.filter(m => m.statusCode === 200).length, 0)
      }
    };
    
    console.log(`✅ API endpoints measured: ${apiRoutes.length} endpoints`);
    
    return apiMetrics;
  }

  /**
   * Analyze authentication patterns from instrumentation data
   */
  private async analyzeAuthPatterns(): Promise<AuthPatternAnalysis> {
    console.log('Analyzing authentication patterns...');
    
    // Get current instrumentation snapshot
    const snapshot = exportMetricsSnapshot();
    
    // Extract auth pattern data
    const usageBreakdown: Record<string, number> = {};
    let mostUsedFunction = '';
    let maxUsage = 0;

    // Parse resolver breakdown for usage patterns
    for (const [resolverKey, count] of Object.entries(snapshot.routeBreakdown)) {
      if (count > maxUsage) {
        maxUsage = count;
        mostUsedFunction = resolverKey;
      }
      usageBreakdown[resolverKey] = count;
    }

    // Identify duplicate call patterns
    const duplicateCallPatterns: Array<{ pattern: string; occurrences: number; routes: string[] }> = [];
    
    // Look for common duplicate patterns in route breakdown
    snapshot.routeBreakdown.forEach(routeData => {
      if (routeData.duplicateCallsDetected) {
        duplicateCallPatterns.push({
          pattern: `Multiple auth calls in ${routeData.route}`,
          occurrences: 1,
          routes: [routeData.route]
        });
      }
    });

    // Identify problem patterns
    const problemPatterns: string[] = [];
    if (snapshot.targetMetrics.authResolutionsPerRequest.current > 2.0) {
      problemPatterns.push(`High auth calls per request: ${snapshot.targetMetrics.authResolutionsPerRequest.current.toFixed(2)}`);
    }
    if (snapshot.targetMetrics.duplicateQueryDetection.current > 0) {
      problemPatterns.push(`${snapshot.targetMetrics.duplicateQueryDetection.current} duplicate queries detected`);
    }
    if (snapshot.targetMetrics.cacheHitRate.current < 0.7) {
      problemPatterns.push(`Low cache hit rate: ${(snapshot.targetMetrics.cacheHitRate.current * 100).toFixed(1)}%`);
    }

    console.log(`✅ Auth patterns analyzed: ${Object.keys(usageBreakdown).length} functions, ${duplicateCallPatterns.length} duplicate patterns`);
    
    return {
      mostUsedFunction,
      usageBreakdown,
      duplicateCallPatterns,
      problemPatterns
    };
  }

  /**
   * Generate comprehensive summary and health score
   */
  private generateSummary(
    coreMetrics: BaselineMetrics, 
    apiMetrics: BaselineMetrics, 
    authPatterns: AuthPatternAnalysis
  ): BaselineSummary {
    console.log('Generating comprehensive summary...');
    
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];
    let healthScore = 100;

    // Analyze auth calls per request
    const authCallsStatus = coreMetrics.targetAnalysis.authResolutionsPerRequestActual <= 1.2 ? 'good' : 
                           coreMetrics.targetAnalysis.authResolutionsPerRequestActual <= 2.0 ? 'warning' : 'critical';
    if (authCallsStatus === 'critical') {
      criticalIssues.push(`Excessive auth calls per request: ${coreMetrics.targetAnalysis.authResolutionsPerRequestActual.toFixed(2)}`);
      recommendations.push('Implement request-level auth context caching');
      healthScore -= 30;
    } else if (authCallsStatus === 'warning') {
      recommendations.push('Review auth call patterns for optimization opportunities');
      healthScore -= 15;
    }

    // Analyze duplicate calls
    const duplicateStatus = coreMetrics.targetAnalysis.duplicateQueryActual === 0 ? 'good' : 
                           coreMetrics.targetAnalysis.duplicateQueryActual <= 5 ? 'warning' : 'critical';
    if (duplicateStatus === 'critical') {
      criticalIssues.push(`High duplicate call count: ${coreMetrics.targetAnalysis.duplicateQueryActual}`);
      recommendations.push('Eliminate duplicate auth resolution calls');
      healthScore -= 25;
    } else if (duplicateStatus === 'warning') {
      recommendations.push('Review and reduce duplicate auth calls');
      healthScore -= 10;
    }

    // Analyze cache hit rate
    const cacheStatus = coreMetrics.targetAnalysis.cacheHitRateActual >= 0.8 ? 'good' :
                        coreMetrics.targetAnalysis.cacheHitRateActual >= 0.6 ? 'warning' : 'critical';
    if (cacheStatus === 'critical') {
      criticalIssues.push(`Low cache hit rate: ${(coreMetrics.targetAnalysis.cacheHitRateActual * 100).toFixed(1)}%`);
      recommendations.push('Improve cache() wrapper usage for better hit rates');
      healthScore -= 20;
    } else if (cacheStatus === 'warning') {
      recommendations.push('Optimize caching strategy for better performance');
      healthScore -= 10;
    }

    // Analyze average latency
    const latencyStatus = coreMetrics.summary.averageRequestLatency <= 100 ? 'good' :
                         coreMetrics.summary.averageRequestLatency <= 300 ? 'warning' : 'critical';
    if (latencyStatus === 'critical') {
      criticalIssues.push(`High average latency: ${coreMetrics.summary.averageRequestLatency.toFixed(0)}ms`);
      recommendations.push('Investigate and optimize high-latency routes');
      healthScore -= 15;
    } else if (latencyStatus === 'warning') {
      recommendations.push('Monitor and optimize request latency');
      healthScore -= 5;
    }

    // Add pattern-specific recommendations
    if (authPatterns.problemPatterns.length > 0) {
      recommendations.push('Address identified authentication anti-patterns');
    }

    console.log(`✅ Summary generated: Health score ${Math.max(0, healthScore)}/100`);

    return {
      healthScore: Math.max(0, healthScore),
      criticalIssues,
      recommendations,
      targetComparison: {
        authCallsPerRequest: {
          target: 1.0,
          actual: coreMetrics.targetAnalysis.authResolutionsPerRequestActual,
          status: authCallsStatus
        },
        duplicateCalls: {
          target: 0,
          actual: coreMetrics.targetAnalysis.duplicateQueryActual,
          status: duplicateStatus
        },
        cacheHitRate: {
          target: 0.8,
          actual: coreMetrics.targetAnalysis.cacheHitRateActual,
          status: cacheStatus
        },
        averageLatency: {
          target: 100,
          actual: coreMetrics.summary.averageRequestLatency,
          status: latencyStatus
        }
      }
    };
  }

  /**
   * Export baseline results in requested format(s)
   */
  private async exportBaseline(baseline: ComprehensiveBaseline): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const baseFilename = `metrics-baseline-${timestamp}`;
    
    // Always export JSON (primary format)
    const jsonPath = path.join(this.config.outputDir!, `${baseFilename}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(baseline, null, 2));
    console.log(`📄 JSON export: ${jsonPath}`);
    
    // Export Wave 0 specific format for docs/baseline/metrics-initial.json
    const wave0Path = path.join(this.config.outputDir!, 'metrics-initial.json');
    const wave0Format = this.convertToWave0Format(baseline);
    await fs.writeFile(wave0Path, JSON.stringify(wave0Format, null, 2));
    console.log(`📄 Wave 0 format: ${wave0Path}`);

    // Export additional formats if requested
    if (this.config.outputFormat === 'markdown') {
      const mdPath = path.join(this.config.outputDir!, `${baseFilename}.md`);
      await fs.writeFile(mdPath, this.generateMarkdownReport(baseline));
      console.log(`📄 Markdown export: ${mdPath}`);
    }
    
    if (this.config.outputFormat === 'csv') {
      const csvPath = path.join(this.config.outputDir!, `${baseFilename}.csv`);
      await fs.writeFile(csvPath, this.generateCSVReport(baseline));
      console.log(`📄 CSV export: ${csvPath}`);
    }
  }

  /**
   * Convert to Wave 0 specific JSON format
   */
  private convertToWave0Format(baseline: ComprehensiveBaseline): any {
    return {
      baselineDate: baseline.measurementDate,
      measurementConfig: {
        iterations: baseline.configuration.iterations,
        warmupRequests: baseline.configuration.warmupRequests,
        routesCovered: baseline.coreRoutes.routes.length
      },
      targetMetrics: {
        authResolutionsPerRequest: {
          target: baseline.summary.targetComparison.authCallsPerRequest.target,
          current: baseline.summary.targetComparison.authCallsPerRequest.actual,
          deviation: Math.round(((baseline.summary.targetComparison.authCallsPerRequest.actual - baseline.summary.targetComparison.authCallsPerRequest.target) / baseline.summary.targetComparison.authCallsPerRequest.target) * 100),
          status: baseline.summary.targetComparison.authCallsPerRequest.status
        },
        duplicateQueryDetection: {
          target: baseline.summary.targetComparison.duplicateCalls.target,
          current: baseline.summary.targetComparison.duplicateCalls.actual,
          status: baseline.summary.targetComparison.duplicateCalls.status
        },
        cacheHitRate: {
          target: baseline.summary.targetComparison.cacheHitRate.target,
          current: baseline.summary.targetComparison.cacheHitRate.actual,
          status: baseline.summary.targetComparison.cacheHitRate.status
        }
      },
      routeBreakdown: baseline.coreRoutes.routes.map(route => ({
        route: route.path,
        averageAuthCalls: route.averageAuthCalls,
        averageLatency: route.averageLatency,
        duplicateCallsDetected: route.duplicateCallsDetected,
        cacheEffectiveness: route.cacheEffectiveness,
        issues: route.issues
      })),
      authPatternAnalysis: baseline.authPatterns,
      performance: {
        averageAuthLatency: Math.round(baseline.coreRoutes.summary.averageRequestLatency),
        p95AuthLatency: Math.round(baseline.coreRoutes.summary.averageRequestLatency * 1.5), // Approximation
        slowestRoute: baseline.coreRoutes.routes.reduce((slowest, route) => route.averageLatency > slowest.averageLatency ? route : slowest, baseline.coreRoutes.routes[0])?.route || 'unknown',
        fastestRoute: baseline.coreRoutes.routes.reduce((fastest, route) => route.averageLatency < fastest.averageLatency ? route : fastest, baseline.coreRoutes.routes[0])?.route || 'unknown',
        cacheOverallHitRate: baseline.summary.targetComparison.cacheHitRate.actual
      },
      recommendations: baseline.summary.recommendations
    };
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(baseline: ComprehensiveBaseline): string {
    return `# Wave 0 Authentication Baseline Report

**Generated:** ${baseline.measurementDate}
**Health Score:** ${baseline.summary.healthScore}/100

## Summary

- **Auth Calls per Request:** ${baseline.summary.targetComparison.authCallsPerRequest.actual.toFixed(2)} (target: ${baseline.summary.targetComparison.authCallsPerRequest.target})
- **Duplicate Calls:** ${baseline.summary.targetComparison.duplicateCalls.actual} (target: ${baseline.summary.targetComparison.duplicateCalls.target})
- **Cache Hit Rate:** ${(baseline.summary.targetComparison.cacheHitRate.actual * 100).toFixed(1)}% (target: ${baseline.summary.targetComparison.cacheHitRate.target * 100}%)
- **Average Latency:** ${baseline.summary.targetComparison.averageLatency.actual.toFixed(0)}ms (target: ${baseline.summary.targetComparison.averageLatency.target}ms)

## Critical Issues

${baseline.summary.criticalIssues.length > 0 ? baseline.summary.criticalIssues.map(issue => `- ${issue}`).join('\n') : 'No critical issues found.'}

## Recommendations

${baseline.summary.recommendations.map(rec => `- ${rec}`).join('\n')}

## Route Analysis

${baseline.coreRoutes.routes.map(route => `
### ${route.route} (${route.path})

- **Average Auth Calls:** ${route.averageAuthCalls.toFixed(2)}
- **Average Latency:** ${route.averageLatency}ms
- **Duplicate Calls:** ${route.duplicateCallsDetected ? 'Yes' : 'No'}
- **Cache Effectiveness:** ${(route.cacheEffectiveness * 100).toFixed(1)}%
${route.issues.length > 0 ? `- **Issues:** ${route.issues.join(', ')}` : ''}
`).join('')}
`;
  }

  /**
   * Generate CSV report
   */
  private generateCSVReport(baseline: ComprehensiveBaseline): string {
    const headers = ['Route,Path,AvgAuthCalls,AvgLatency,DuplicateCalls,CacheEffectiveness,Issues'];
    const rows = baseline.coreRoutes.routes.map(route => 
      `${route.route},${route.path},${route.averageAuthCalls.toFixed(2)},${route.averageLatency},${route.duplicateCallsDetected},${(route.cacheEffectiveness * 100).toFixed(1)}%,"${route.issues.join('; ')}"`
    );
    return [headers, ...rows].join('\n');
  }

  /**
   * Print summary report to console
   */
  private printSummaryReport(summary: BaselineSummary): void {
    console.log('\n🏆 WAVE 0 BASELINE SUMMARY');
    console.log('===========================');
    console.log(`Health Score: ${summary.healthScore}/100`);
    console.log('\nTarget Analysis:');
    console.log(`📊 Auth calls per request: ${summary.targetComparison.authCallsPerRequest.actual.toFixed(2)} (target: ${summary.targetComparison.authCallsPerRequest.target}) - ${summary.targetComparison.authCallsPerRequest.status.toUpperCase()}`);
    console.log(`🔄 Duplicate calls: ${summary.targetComparison.duplicateCalls.actual} (target: ${summary.targetComparison.duplicateCalls.target}) - ${summary.targetComparison.duplicateCalls.status.toUpperCase()}`);
    console.log(`💾 Cache hit rate: ${(summary.targetComparison.cacheHitRate.actual * 100).toFixed(1)}% (target: ${summary.targetComparison.cacheHitRate.target * 100}%) - ${summary.targetComparison.cacheHitRate.status.toUpperCase()}`);
    console.log(`⚡ Average latency: ${summary.targetComparison.averageLatency.actual.toFixed(0)}ms (target: ${summary.targetComparison.averageLatency.target}ms) - ${summary.targetComparison.averageLatency.status.toUpperCase()}`);
    
    if (summary.criticalIssues.length > 0) {
      console.log('\n🚨 Critical Issues:');
      summary.criticalIssues.forEach(issue => console.log(`   - ${issue}`));
    }
    
    if (summary.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      summary.recommendations.forEach(rec => console.log(`   - ${rec}`));
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI interface
if (import.meta.main) {
  const config: Partial<BaselineConfig> = {
    iterations: parseInt(process.env.ITERATIONS || '10'),
    warmupRequests: parseInt(process.env.WARMUP_REQUESTS || '3'),
    outputFormat: (process.env.OUTPUT_FORMAT as 'json' | 'markdown' | 'csv') || 'json',
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000'
  };

  const runner = new BaselineRunner(config);
  
  try {
    await runner.executeFullBaseline();
    process.exit(0);
  } catch (error) {
    console.error('❌ Baseline measurement failed:', error);
    process.exit(1);
  }
}