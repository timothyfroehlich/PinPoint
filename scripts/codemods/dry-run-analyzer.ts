/**
 * Dry-Run Analysis Engine - Phase 0 Infrastructure
 * Comprehensive analysis and preview of codemod transformations
 * 
 * This module provides:
 * - Detailed impact analysis without file modifications
 * - Risk assessment and confidence scoring
 * - Transformation opportunity detection
 * - Structured reporting for decision making
 */

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { glob } from "glob";
import { ASTAnalyzer, createASTAnalyzer, AuthPatternAnalysis } from "./utils/ast-utils";

/**
 * Dry-run configuration
 */
export interface DryRunConfig {
  /** Codemod name */
  codemodName: string;
  
  /** File patterns to analyze */
  targetPatterns: string[];
  
  /** Transform file path */
  transformPath: string;
  
  /** Maximum files to analyze */
  maxFiles?: number;
  
  /** Include confidence analysis */
  includeConfidenceAnalysis?: boolean;
  
  /** Include risk assessment */
  includeRiskAssessment?: boolean;
  
  /** Parser type for jscodeshift */
  parser?: 'babel' | 'tsx' | 'ts' | 'flow';
}

/**
 * Planned change details
 */
export interface PlannedChange {
  /** File path */
  file: string;
  
  /** Line number where change occurs */
  lineNumber: number;
  
  /** Type of change */
  changeType: 'function-call' | 'import' | 'parameter' | 'return-type' | 'variable-declaration' | 'other';
  
  /** Current code (before transformation) */
  before: string;
  
  /** Proposed code (after transformation) */
  after: string;
  
  /** Confidence level in this change */
  confidence: 'high' | 'medium' | 'low';
  
  /** Additional context */
  context?: string;
  
  /** Estimated impact scope */
  impactScope: 'local' | 'file' | 'module' | 'project';
}

/**
 * Transformation risk assessment
 */
export interface TransformationRisk {
  /** Risk type */
  type: 'type-mismatch' | 'breaking-change' | 'import-conflict' | 'syntax-error' | 'semantic-change' | 'performance-impact';
  
  /** Risk severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** Files affected by this risk */
  files: string[];
  
  /** Human-readable description */
  description: string;
  
  /** Suggested mitigation */
  mitigation?: string;
  
  /** Likelihood of occurrence */
  likelihood: 'low' | 'medium' | 'high';
}

/**
 * Impact analysis summary
 */
export interface ImpactAnalysis {
  /** Estimated files affected */
  filesAffected: number;
  
  /** Total number of changes */
  totalChanges: number;
  
  /** Changes by type */
  changesByType: Record<PlannedChange['changeType'], number>;
  
  /** Changes by confidence */
  changesByConfidence: Record<PlannedChange['confidence'], number>;
  
  /** Estimated breaking changes */
  estimatedBreakingChanges: number;
  
  /** Overall transformation complexity */
  complexity: 'simple' | 'moderate' | 'complex' | 'high-risk';
  
  /** Recommended approach */
  recommendedApproach: 'proceed' | 'proceed-with-caution' | 'manual-review-required' | 'not-recommended';
}

/**
 * Complete dry-run analysis result
 */
export interface DryRunResult {
  /** Configuration used */
  config: DryRunConfig;
  
  /** Files that would be targeted */
  targetFiles: string[];
  
  /** Detailed planned changes */
  plannedChanges: PlannedChange[];
  
  /** Identified risks */
  potentialIssues: TransformationRisk[];
  
  /** Impact analysis */
  estimatedImpact: ImpactAnalysis;
  
  /** Execution timestamp */
  analysisTimestamp: Date;
  
  /** Analysis duration in milliseconds */
  analysisDurationMs: number;
}

/**
 * Main dry-run analyzer class
 */
export class DryRunAnalyzer {
  private astAnalyzer: ASTAnalyzer;
  
  constructor() {
    this.astAnalyzer = createASTAnalyzer({
      skipTypeChecking: false, // We want type information for risk analysis
    });
  }

  /**
   * Analyze a planned transformation comprehensively
   */
  async analyzePlannedTransformation(config: DryRunConfig): Promise<DryRunResult> {
    const startTime = Date.now();
    
    const result: DryRunResult = {
      config,
      targetFiles: [],
      plannedChanges: [],
      potentialIssues: [],
      estimatedImpact: {
        filesAffected: 0,
        totalChanges: 0,
        changesByType: {} as any,
        changesByConfidence: {} as any,
        estimatedBreakingChanges: 0,
        complexity: 'simple',
        recommendedApproach: 'proceed',
      },
      analysisTimestamp: new Date(),
      analysisDurationMs: 0,
    };

    try {
      console.log(`Starting dry-run analysis for: ${config.codemodName}`);
      
      // Step 1: Discover target files
      result.targetFiles = await this.discoverTargetFiles(config.targetPatterns);
      
      if (config.maxFiles && result.targetFiles.length > config.maxFiles) {
        result.targetFiles = result.targetFiles.slice(0, config.maxFiles);
        console.log(`Limited analysis to ${config.maxFiles} files`);
      }
      
      if (result.targetFiles.length === 0) {
        console.log('No target files found matching patterns');
        return result;
      }
      
      console.log(`Analyzing ${result.targetFiles.length} files...`);
      
      // Step 2: Analyze each file for planned changes
      for (const filePath of result.targetFiles) {
        try {
          const fileChanges = await this.analyzeFileTransformation(filePath, config);
          result.plannedChanges.push(...fileChanges);
        } catch (error) {
          console.warn(`Failed to analyze file ${filePath}: ${error}`);
        }
      }
      
      // Step 3: Risk assessment
      if (config.includeRiskAssessment !== false) {
        result.potentialIssues = await this.assessTransformationRisks(result.plannedChanges, config);
      }
      
      // Step 4: Impact analysis
      result.estimatedImpact = this.calculateImpactAnalysis(result.plannedChanges, result.potentialIssues);
      
      console.log(`Analysis complete: ${result.plannedChanges.length} changes planned across ${result.estimatedImpact.filesAffected} files`);
      
    } catch (error) {
      console.error(`Dry-run analysis failed: ${error}`);
      throw error;
    } finally {
      result.analysisDurationMs = Date.now() - startTime;
    }
    
    return result;
  }

  /**
   * Generate a human-readable transformation report
   */
  async generateTransformationReport(result: DryRunResult): Promise<string> {
    const { config, targetFiles, plannedChanges, potentialIssues, estimatedImpact } = result;
    
    const report = [
      '# Codemod Dry-Run Analysis Report',
      '',
      `**Codemod:** ${config.codemodName}`,
      `**Analysis Date:** ${result.analysisTimestamp.toISOString()}`,
      `**Analysis Duration:** ${result.analysisDurationMs}ms`,
      '',
      '## Executive Summary',
      '',
      `- **Target Files:** ${targetFiles.length}`,
      `- **Files Affected:** ${estimatedImpact.filesAffected}`,
      `- **Total Changes:** ${estimatedImpact.totalChanges}`,
      `- **Complexity:** ${estimatedImpact.complexity}`,
      `- **Recommendation:** ${estimatedImpact.recommendedApproach}`,
      '',
    ];

    // Impact breakdown
    report.push('## Impact Analysis');
    report.push('');
    report.push('### Changes by Type');
    Object.entries(estimatedImpact.changesByType).forEach(([type, count]) => {
      if (count > 0) {
        report.push(`- **${type}**: ${count} changes`);
      }
    });
    
    report.push('');
    report.push('### Changes by Confidence');
    Object.entries(estimatedImpact.changesByConfidence).forEach(([confidence, count]) => {
      if (count > 0) {
        const emoji = confidence === 'high' ? '🟢' : confidence === 'medium' ? '🟡' : '🔴';
        report.push(`- ${emoji} **${confidence}**: ${count} changes`);
      }
    });
    
    // Risk assessment
    if (potentialIssues.length > 0) {
      report.push('');
      report.push('## Risk Assessment');
      report.push('');
      
      const risksBySeverity = potentialIssues.reduce((acc, risk) => {
        acc[risk.severity] = (acc[risk.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      Object.entries(risksBySeverity).forEach(([severity, count]) => {
        const emoji = severity === 'critical' ? '🚨' : 
                     severity === 'high' ? '⚠️' : 
                     severity === 'medium' ? '🟡' : '🟢';
        report.push(`${emoji} **${severity.toUpperCase()}**: ${count} issues`);
      });
      
      report.push('');
      report.push('### Detailed Risks');
      potentialIssues.forEach((risk, index) => {
        report.push(`${index + 1}. **${risk.type}** (${risk.severity})`);
        report.push(`   - ${risk.description}`);
        report.push(`   - Affects: ${risk.files.length} file(s)`);
        if (risk.mitigation) {
          report.push(`   - Mitigation: ${risk.mitigation}`);
        }
        report.push('');
      });
    }
    
    // File-by-file breakdown
    if (plannedChanges.length > 0) {
      report.push('## Planned Changes');
      report.push('');
      
      const changesByFile = plannedChanges.reduce((acc, change) => {
        if (!acc[change.file]) {
          acc[change.file] = [];
        }
        acc[change.file].push(change);
        return acc;
      }, {} as Record<string, PlannedChange[]>);
      
      Object.entries(changesByFile).forEach(([file, changes]) => {
        report.push(`### ${path.relative(process.cwd(), file)}`);
        report.push('');
        
        changes.forEach(change => {
          const confidenceEmoji = change.confidence === 'high' ? '🟢' : 
                                 change.confidence === 'medium' ? '🟡' : '🔴';
          report.push(`${confidenceEmoji} **Line ${change.lineNumber}**: ${change.changeType}`);
          report.push('```typescript');
          report.push(`// Before`);
          report.push(change.before);
          report.push('');
          report.push(`// After`);
          report.push(change.after);
          report.push('```');
          report.push('');
        });
      });
    }
    
    // Recommendations
    report.push('## Recommendations');
    report.push('');
    
    switch (estimatedImpact.recommendedApproach) {
      case 'proceed':
        report.push('✅ **Safe to proceed** - Low risk transformation with high confidence changes.');
        break;
      case 'proceed-with-caution':
        report.push('⚠️ **Proceed with caution** - Some risks identified but manageable with proper testing.');
        break;
      case 'manual-review-required':
        report.push('🔍 **Manual review required** - Complex changes that need human verification.');
        break;
      case 'not-recommended':
        report.push('🚫 **Not recommended** - High risk transformation that may cause significant issues.');
        break;
    }
    
    report.push('');
    report.push('### Next Steps');
    report.push('1. Review the planned changes above');
    report.push('2. Address any high-severity risks');
    report.push('3. Consider running on a smaller subset first');
    report.push('4. Ensure comprehensive test coverage');
    report.push('5. Create a backup/snapshot before execution');
    
    return report.join('\n');
  }

  // Private helper methods

  private async discoverTargetFiles(patterns: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, { 
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**'],
          absolute: true,
        });
        allFiles.push(...files);
      } catch (error) {
        console.warn(`Failed to match pattern "${pattern}": ${error}`);
      }
    }
    
    return [...new Set(allFiles)].sort();
  }

  private async analyzeFileTransformation(
    filePath: string, 
    config: DryRunConfig
  ): Promise<PlannedChange[]> {
    const changes: PlannedChange[] = [];
    
    try {
      // Read file content
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Run jscodeshift in dry-run mode to see what would change
      const transformPath = path.resolve(config.transformPath);
      const parser = config.parser || 'tsx';
      
      const command = `npx jscodeshift -t "${transformPath}" "${filePath}" --dry --print --parser=${parser}`;
      
      try {
        const output = execSync(command, { 
          encoding: 'utf8', 
          stdio: 'pipe',
          timeout: 30000,
        });
        
        // Parse jscodeshift output to extract changes
        const transformedCode = this.extractTransformedCode(output);
        
        if (transformedCode && transformedCode !== content) {
          const detectedChanges = this.detectChanges(content, transformedCode, filePath);
          changes.push(...detectedChanges);
        }
        
      } catch (jscodeshiftError) {
        console.warn(`Jscodeshift analysis failed for ${filePath}: ${jscodeshiftError}`);
      }
      
      // Also use AST analysis for additional insights
      if (this.shouldUseASTAnalysis(config.codemodName)) {
        const astChanges = await this.analyzeWithAST(filePath, config);
        changes.push(...astChanges);
      }
      
    } catch (error) {
      console.warn(`Failed to analyze file ${filePath}: ${error}`);
    }
    
    return changes;
  }

  private extractTransformedCode(jscodeshiftOutput: string): string | null {
    // jscodeshift with --print outputs the transformed code
    // We need to extract it from the output
    const lines = jscodeshiftOutput.split('\n');
    
    // Find the start of the actual code (skip jscodeshift messages)
    let codeStartIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() && !lines[i].includes('Processing') && !lines[i].includes('Skipping')) {
        codeStartIndex = i;
        break;
      }
    }
    
    if (codeStartIndex === -1) {
      return null;
    }
    
    return lines.slice(codeStartIndex).join('\n');
  }

  private detectChanges(
    originalCode: string, 
    transformedCode: string, 
    filePath: string
  ): PlannedChange[] {
    const changes: PlannedChange[] = [];
    const originalLines = originalCode.split('\n');
    const transformedLines = transformedCode.split('\n');
    
    // Simple line-by-line diff
    const maxLines = Math.max(originalLines.length, transformedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i] || '';
      const transformedLine = transformedLines[i] || '';
      
      if (originalLine !== transformedLine) {
        changes.push({
          file: filePath,
          lineNumber: i + 1,
          changeType: this.classifyChangeType(originalLine, transformedLine),
          before: originalLine.trim(),
          after: transformedLine.trim(),
          confidence: this.assessChangeConfidence(originalLine, transformedLine),
          impactScope: this.assessImpactScope(originalLine, transformedLine),
        });
      }
    }
    
    return changes;
  }

  private async analyzeWithAST(filePath: string, config: DryRunConfig): Promise<PlannedChange[]> {
    const changes: PlannedChange[] = [];
    
    try {
      const sourceFile = this.astAnalyzer.getFilesByPattern(filePath)[0];
      if (!sourceFile) return changes;
      
      // Analyze auth patterns if this is an auth-related codemod
      if (config.codemodName.includes('auth') || config.codemodName.includes('member-access')) {
        const authAnalysis = this.astAnalyzer.analyzeAuthPatterns(sourceFile);
        
        authAnalysis.migrationOpportunities.forEach(opp => {
          changes.push({
            file: filePath,
            lineNumber: opp.line,
            changeType: 'function-call',
            before: opp.current,
            after: opp.suggested,
            confidence: opp.confidence,
            impactScope: 'local',
            context: 'Auth pattern migration opportunity',
          });
        });
      }
      
      // Find other transformation opportunities
      const opportunities = this.astAnalyzer.findTransformationOpportunities(sourceFile);
      opportunities.forEach(opp => {
        changes.push({
          file: filePath,
          lineNumber: opp.line,
          changeType: opp.type === 'auth-migration' ? 'function-call' : 
                     opp.type === 'dal-migration' ? 'function-call' : 'import',
          before: opp.description.split(' → ')[0] || opp.description,
          after: opp.description.split(' → ')[1] || 'See description',
          confidence: opp.confidence,
          impactScope: 'file',
          context: opp.description,
        });
      });
      
    } catch (error) {
      console.warn(`AST analysis failed for ${filePath}: ${error}`);
    }
    
    return changes;
  }

  private shouldUseASTAnalysis(codemodName: string): boolean {
    // Use AST analysis for complex transformations
    return codemodName.includes('auth') || 
           codemodName.includes('dal') || 
           codemodName.includes('migration');
  }

  private classifyChangeType(original: string, transformed: string): PlannedChange['changeType'] {
    if (original.includes('import') || transformed.includes('import')) {
      return 'import';
    }
    if (original.includes('(') && transformed.includes('(')) {
      return 'function-call';
    }
    if (original.includes('const') || original.includes('let') || original.includes('var')) {
      return 'variable-declaration';
    }
    if (original.includes('=>') || transformed.includes('=>')) {
      return 'function-call';
    }
    return 'other';
  }

  private assessChangeConfidence(original: string, transformed: string): PlannedChange['confidence'] {
    // High confidence for simple replacements
    if (original.includes('requireMemberAccess') && transformed.includes('getRequestAuthContext')) {
      return 'high';
    }
    
    // Medium confidence for import changes
    if (original.includes('import') && transformed.includes('import')) {
      return 'medium';
    }
    
    // Low confidence for complex changes
    if (Math.abs(original.length - transformed.length) > 50) {
      return 'low';
    }
    
    return 'medium';
  }

  private assessImpactScope(original: string, transformed: string): PlannedChange['impactScope'] {
    if (original.includes('export') || transformed.includes('export')) {
      return 'module';
    }
    if (original.includes('import') || transformed.includes('import')) {
      return 'file';
    }
    return 'local';
  }

  private async assessTransformationRisks(
    changes: PlannedChange[], 
    config: DryRunConfig
  ): Promise<TransformationRisk[]> {
    const risks: TransformationRisk[] = [];
    
    // Group changes by file for analysis
    const changesByFile = changes.reduce((acc, change) => {
      if (!acc[change.file]) {
        acc[change.file] = [];
      }
      acc[change.file].push(change);
      return acc;
    }, {} as Record<string, PlannedChange[]>);
    
    // Analyze risks per file
    Object.entries(changesByFile).forEach(([file, fileChanges]) => {
      // Risk: Too many low-confidence changes
      const lowConfidenceChanges = fileChanges.filter(c => c.confidence === 'low');
      if (lowConfidenceChanges.length > 3) {
        risks.push({
          type: 'breaking-change',
          severity: 'medium',
          files: [file],
          description: `High number of low-confidence changes (${lowConfidenceChanges.length}) may indicate complex transformation`,
          likelihood: 'medium',
          mitigation: 'Review each low-confidence change manually before applying',
        });
      }
      
      // Risk: Import conflicts
      const importChanges = fileChanges.filter(c => c.changeType === 'import');
      if (importChanges.length > 5) {
        risks.push({
          type: 'import-conflict',
          severity: 'low',
          files: [file],
          description: 'Multiple import changes may cause conflicts',
          likelihood: 'low',
          mitigation: 'Verify import statements after transformation',
        });
      }
      
      // Risk: Function signature changes
      const functionChanges = fileChanges.filter(c => 
        c.changeType === 'function-call' || c.changeType === 'parameter'
      );
      if (functionChanges.length > 2) {
        risks.push({
          type: 'type-mismatch',
          severity: 'medium',
          files: [file],
          description: 'Multiple function signature changes may break downstream usage',
          likelihood: 'medium',
          mitigation: 'Run TypeScript compiler and tests after transformation',
        });
      }
    });
    
    // Global risks
    if (changes.length > 100) {
      risks.push({
        type: 'semantic-change',
        severity: 'high',
        files: Object.keys(changesByFile),
        description: `Large-scale transformation (${changes.length} changes) has high risk of unintended consequences`,
        likelihood: 'medium',
        mitigation: 'Consider running transformation in smaller batches',
      });
    }
    
    return risks;
  }

  private calculateImpactAnalysis(
    changes: PlannedChange[], 
    risks: TransformationRisk[]
  ): ImpactAnalysis {
    const filesAffected = new Set(changes.map(c => c.file)).size;
    
    const changesByType = changes.reduce((acc, change) => {
      acc[change.changeType] = (acc[change.changeType] || 0) + 1;
      return acc;
    }, {} as Record<PlannedChange['changeType'], number>);
    
    const changesByConfidence = changes.reduce((acc, change) => {
      acc[change.confidence] = (acc[change.confidence] || 0) + 1;
      return acc;
    }, {} as Record<PlannedChange['confidence'], number>);
    
    // Estimate breaking changes
    const estimatedBreakingChanges = changes.filter(c => 
      c.confidence === 'low' || 
      c.impactScope === 'module' || 
      c.impactScope === 'project'
    ).length;
    
    // Determine complexity
    let complexity: ImpactAnalysis['complexity'];
    if (changes.length > 50 || risks.some(r => r.severity === 'critical')) {
      complexity = 'high-risk';
    } else if (changes.length > 20 || risks.some(r => r.severity === 'high')) {
      complexity = 'complex';
    } else if (changes.length > 5 || risks.some(r => r.severity === 'medium')) {
      complexity = 'moderate';
    } else {
      complexity = 'simple';
    }
    
    // Determine recommended approach
    let recommendedApproach: ImpactAnalysis['recommendedApproach'];
    if (risks.some(r => r.severity === 'critical') || estimatedBreakingChanges > 10) {
      recommendedApproach = 'not-recommended';
    } else if (risks.some(r => r.severity === 'high') || complexity === 'high-risk') {
      recommendedApproach = 'manual-review-required';
    } else if (risks.some(r => r.severity === 'medium') || complexity === 'complex') {
      recommendedApproach = 'proceed-with-caution';
    } else {
      recommendedApproach = 'proceed';
    }
    
    return {
      filesAffected,
      totalChanges: changes.length,
      changesByType,
      changesByConfidence,
      estimatedBreakingChanges,
      complexity,
      recommendedApproach,
    };
  }
}

/**
 * Factory function for creating dry-run analyzer
 */
export function createDryRunAnalyzer(): DryRunAnalyzer {
  return new DryRunAnalyzer();
}

/**
 * Utility function to run quick dry-run analysis
 */
export async function quickDryRunAnalysis(
  codemodName: string,
  targetPatterns: string[],
  transformPath: string
): Promise<string> {
  const analyzer = createDryRunAnalyzer();
  
  const config: DryRunConfig = {
    codemodName,
    targetPatterns,
    transformPath,
    maxFiles: 10, // Quick analysis
    includeConfidenceAnalysis: true,
    includeRiskAssessment: true,
  };
  
  const result = await analyzer.analyzePlannedTransformation(config);
  return await analyzer.generateTransformationReport(result);
}