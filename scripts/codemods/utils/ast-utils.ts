/**
 * AST Analysis Utilities - Phase 0 Infrastructure
 * TypeScript AST manipulation and analysis toolkit using ts-morph
 * 
 * This module provides:
 * - Function pattern detection and analysis
 * - Import management utilities
 * - Safe transformation helpers
 * - Syntax and type validation
 * - Pattern matching for transformation opportunities
 */

import { 
  Project, 
  SourceFile, 
  SyntaxKind, 
  FunctionDeclaration,
  ArrowFunction,
  CallExpression,
  ImportDeclaration,
  VariableDeclaration,
  Node,
  TypeChecker,
  Scope,
  Diagnostic
} from "ts-morph";
import * as path from "path";

/**
 * Configuration for AST analysis
 */
export interface ASTAnalysisConfig {
  /** Path to tsconfig.json */
  tsConfigPath?: string;
  
  /** Include node_modules in analysis */
  includeNodeModules?: boolean;
  
  /** Skip type checking for faster analysis */
  skipTypeChecking?: boolean;
}

/**
 * Function analysis result
 */
export interface FunctionAnalysis {
  /** Function name */
  name: string;
  
  /** Function type */
  type: 'function' | 'arrow' | 'method';
  
  /** Whether function is async */
  isAsync: boolean;
  
  /** Whether function is exported */
  isExported: boolean;
  
  /** Parameter names and types */
  parameters: Array<{
    name: string;
    type?: string;
    isOptional: boolean;
  }>;
  
  /** Return type if available */
  returnType?: string;
  
  /** Line number where function starts */
  startLine: number;
  
  /** Function calls made within this function */
  callsTo: string[];
}

/**
 * Auth pattern analysis result
 */
export interface AuthPatternAnalysis {
  /** File path */
  file: string;
  
  /** Auth function calls found */
  authCalls: Array<{
    functionName: string;
    line: number;
    confidence: 'high' | 'medium' | 'low';
    pattern: 'require-member-access' | 'organization-context' | 'ensure-org-context' | 'unknown';
  }>;
  
  /** Import statements related to auth */
  authImports: Array<{
    from: string;
    imports: string[];
  }>;
  
  /** Potential migration opportunities */
  migrationOpportunities: Array<{
    line: number;
    current: string;
    suggested: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

/**
 * Validation error details
 */
export interface ValidationError {
  /** Error message */
  message: string;
  
  /** Error category */
  category: 'syntax' | 'type' | 'import' | 'semantic';
  
  /** Severity level */
  severity: 'error' | 'warning';
  
  /** File where error occurred */
  file?: string;
  
  /** Line number */
  line?: number;
  
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Main AST analyzer class
 */
export class ASTAnalyzer {
  private project: Project;
  private typeChecker: TypeChecker;
  
  constructor(config: ASTAnalysisConfig = {}) {
    const tsConfigPath = config.tsConfigPath || "tsconfig.json";
    
    this.project = new Project({
      tsConfigFilePath: path.resolve(tsConfigPath),
      addFilesFromTsConfig: true,
      skipAddingFilesFromTsConfig: config.includeNodeModules === false,
      compilerOptions: config.skipTypeChecking ? {
        skipLibCheck: true,
        noResolve: true,
      } : undefined,
    });
    
    this.typeChecker = this.project.getTypeChecker();
  }

  /**
   * Analyze a source file for function patterns
   */
  analyzeFunctionPatterns(sourceFile: SourceFile): FunctionAnalysis[] {
    const functions: FunctionAnalysis[] = [];
    
    // Find function declarations
    sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(func => {
      const analysis = this.analyzeFunctionNode(func);
      if (analysis) {
        functions.push(analysis);
      }
    });
    
    // Find arrow functions
    sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction).forEach(func => {
      const analysis = this.analyzeFunctionNode(func);
      if (analysis) {
        functions.push(analysis);
      }
    });
    
    // Find method declarations
    sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration).forEach(method => {
      const analysis = this.analyzeFunctionNode(method);
      if (analysis) {
        functions.push(analysis);
      }
    });
    
    return functions;
  }

  /**
   * Find all async functions in a source file
   */
  findAsyncFunctions(sourceFile: SourceFile): FunctionDeclaration[] {
    return sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration)
      .filter(fn => fn.isAsync());
  }

  /**
   * Find auth-related function calls
   */
  findAuthFunctionCalls(sourceFile: SourceFile): CallExpression[] {
    return sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .filter(call => this.isAuthFunctionCall(call));
  }

  /**
   * Analyze auth patterns in a source file
   */
  analyzeAuthPatterns(sourceFile: SourceFile): AuthPatternAnalysis {
    const analysis: AuthPatternAnalysis = {
      file: sourceFile.getFilePath(),
      authCalls: [],
      authImports: [],
      migrationOpportunities: [],
    };

    // Find auth-related imports
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      if (this.isAuthRelatedImport(moduleSpecifier)) {
        const imports = importDecl.getNamedImports()
          .map(namedImport => namedImport.getName());
        
        if (imports.length > 0) {
          analysis.authImports.push({
            from: moduleSpecifier,
            imports,
          });
        }
      }
    });

    // Find auth function calls
    this.findAuthFunctionCalls(sourceFile).forEach(call => {
      const functionName = this.getCallExpressionName(call);
      if (functionName) {
        const pattern = this.classifyAuthPattern(functionName);
        const confidence = this.assessPatternConfidence(call, pattern);
        
        analysis.authCalls.push({
          functionName,
          line: call.getStartLineNumber(),
          confidence,
          pattern,
        });

        // Check for migration opportunities
        const opportunity = this.assessMigrationOpportunity(call, functionName, pattern);
        if (opportunity) {
          analysis.migrationOpportunities.push(opportunity);
        }
      }
    });

    return analysis;
  }

  /**
   * Add an import statement if it doesn't exist
   */
  addImportIfMissing(
    sourceFile: SourceFile, 
    moduleSpecifier: string, 
    importName: string
  ): boolean {
    // Check if import already exists
    const existingImport = sourceFile.getImportDeclaration(moduleSpecifier);
    
    if (existingImport) {
      const namedImports = existingImport.getNamedImports();
      const hasImport = namedImports.some(namedImport => 
        namedImport.getName() === importName
      );
      
      if (!hasImport) {
        existingImport.addNamedImport(importName);
        return true;
      }
    } else {
      // Create new import
      sourceFile.addImportDeclaration({
        moduleSpecifier,
        namedImports: [importName],
      });
      return true;
    }
    
    return false;
  }

  /**
   * Remove unused imports from a source file
   */
  removeUnusedImports(sourceFile: SourceFile): string[] {
    const removedImports: string[] = [];
    
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const namedImports = importDecl.getNamedImports();
      const unusedImports: string[] = [];
      
      namedImports.forEach(namedImport => {
        const identifier = namedImport.getName();
        const references = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
          .filter(id => id.getText() === identifier && id !== namedImport.getNameNode());
        
        if (references.length === 0) {
          unusedImports.push(identifier);
          namedImport.remove();
        }
      });
      
      removedImports.push(...unusedImports);
      
      // Remove entire import if no named imports remain
      if (importDecl.getNamedImports().length === 0 && 
          !importDecl.getDefaultImport() && 
          !importDecl.getNamespaceImport()) {
        importDecl.remove();
      }
    });
    
    return removedImports;
  }

  /**
   * Safely replace a call expression
   */
  replaceCallExpression(call: CallExpression, newExpression: string): boolean {
    try {
      call.replaceWithText(newExpression);
      return true;
    } catch (error) {
      console.warn(`Failed to replace call expression: ${error}`);
      return false;
    }
  }

  /**
   * Get all files in the project matching a pattern
   */
  getFilesByPattern(pattern: string): SourceFile[] {
    return this.project.getSourceFiles(pattern);
  }

  /**
   * Analyze dependencies between functions
   */
  analyzeFunctionDependencies(sourceFile: SourceFile): Map<string, string[]> {
    const dependencies = new Map<string, string[]>();
    const functions = this.analyzeFunctionPatterns(sourceFile);
    
    functions.forEach(func => {
      dependencies.set(func.name, func.callsTo);
    });
    
    return dependencies;
  }

  /**
   * Find transformation opportunities in a source file
   */
  findTransformationOpportunities(sourceFile: SourceFile): Array<{
    line: number;
    type: 'auth-migration' | 'dal-migration' | 'import-cleanup';
    description: string;
    confidence: 'high' | 'medium' | 'low';
  }> {
    const opportunities: Array<{
      line: number;
      type: 'auth-migration' | 'dal-migration' | 'import-cleanup';
      description: string;
      confidence: 'high' | 'medium' | 'low';
    }> = [];

    // Find DAL migration opportunities
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const functionName = this.getCallExpressionName(call);
      
      if (functionName === 'ensureOrgContextAndBindRLS') {
        opportunities.push({
          line: call.getStartLineNumber(),
          type: 'dal-migration',
          description: 'Can be migrated from ensureOrgContextAndBindRLS to withOrgRLS pattern',
          confidence: 'high',
        });
      }
    });

    // Find auth migration opportunities
    const authAnalysis = this.analyzeAuthPatterns(sourceFile);
    authAnalysis.migrationOpportunities.forEach(opp => {
      opportunities.push({
        line: opp.line,
        type: 'auth-migration',
        description: `${opp.current} → ${opp.suggested}`,
        confidence: opp.confidence,
      });
    });

    // Find import cleanup opportunities
    const unusedImports = this.findUnusedImports(sourceFile);
    if (unusedImports.length > 0) {
      opportunities.push({
        line: 1,
        type: 'import-cleanup',
        description: `Remove unused imports: ${unusedImports.join(', ')}`,
        confidence: 'high',
      });
    }

    return opportunities;
  }

  // Private helper methods

  private analyzeFunctionNode(node: Node): FunctionAnalysis | null {
    let name = '';
    let isAsync = false;
    let isExported = false;
    let type: 'function' | 'arrow' | 'method' = 'function';

    // Determine function type and extract name
    if (Node.isFunctionDeclaration(node)) {
      name = node.getName() || '<anonymous>';
      isAsync = node.isAsync();
      isExported = node.isExported();
      type = 'function';
    } else if (Node.isArrowFunction(node)) {
      // For arrow functions, try to get name from parent variable declaration
      const parent = node.getParent();
      if (Node.isVariableDeclaration(parent)) {
        name = parent.getName();
      } else {
        name = '<anonymous>';
      }
      isAsync = node.isAsync();
      type = 'arrow';
    } else if (Node.isMethodDeclaration(node)) {
      name = node.getName();
      isAsync = node.isAsync();
      type = 'method';
    } else {
      return null;
    }

    // Extract parameters
    const parameters = node.getParameters?.()?.map(param => ({
      name: param.getName(),
      type: param.getTypeNode()?.getText(),
      isOptional: param.hasQuestionToken(),
    })) || [];

    // Extract return type
    const returnType = node.getReturnTypeNode?.()?.getText();

    // Find function calls within this function
    const callsTo: string[] = [];
    node.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(call => {
      const functionName = this.getCallExpressionName(call);
      if (functionName) {
        callsTo.push(functionName);
      }
    });

    return {
      name,
      type,
      isAsync,
      isExported,
      parameters,
      returnType,
      startLine: node.getStartLineNumber(),
      callsTo: [...new Set(callsTo)], // Remove duplicates
    };
  }

  private isAuthFunctionCall(call: CallExpression): boolean {
    const functionName = this.getCallExpressionName(call);
    
    const authFunctions = [
      'requireMemberAccess',
      'getOrganizationContext',
      'ensureOrgContextAndBindRLS',
      'getRequestAuthContext',
      'requireAuthorized',
    ];

    return authFunctions.includes(functionName || '');
  }

  private isAuthRelatedImport(moduleSpecifier: string): boolean {
    const authModules = [
      '~/lib/organization-context',
      '~/server/auth/context',
      '~/lib/actions/shared',
      '~/server/db/utils/rls',
    ];

    return authModules.some(module => moduleSpecifier.includes(module));
  }

  private getCallExpressionName(call: CallExpression): string | null {
    const expression = call.getExpression();
    
    if (Node.isIdentifier(expression)) {
      return expression.getText();
    }
    
    if (Node.isPropertyAccessExpression(expression)) {
      return expression.getName();
    }
    
    return null;
  }

  private classifyAuthPattern(functionName: string): AuthPatternAnalysis['authCalls'][0]['pattern'] {
    switch (functionName) {
      case 'requireMemberAccess':
        return 'require-member-access';
      case 'getOrganizationContext':
        return 'organization-context';
      case 'ensureOrgContextAndBindRLS':
        return 'ensure-org-context';
      default:
        return 'unknown';
    }
  }

  private assessPatternConfidence(
    call: CallExpression, 
    pattern: AuthPatternAnalysis['authCalls'][0]['pattern']
  ): 'high' | 'medium' | 'low' {
    // High confidence for well-known patterns
    if (['require-member-access', 'organization-context', 'ensure-org-context'].includes(pattern)) {
      return 'high';
    }
    
    // Medium confidence for imports from auth modules
    const sourceFile = call.getSourceFile();
    const hasAuthImports = sourceFile.getImportDeclarations()
      .some(imp => this.isAuthRelatedImport(imp.getModuleSpecifierValue()));
    
    return hasAuthImports ? 'medium' : 'low';
  }

  private assessMigrationOpportunity(
    call: CallExpression,
    functionName: string,
    pattern: AuthPatternAnalysis['authCalls'][0]['pattern']
  ): AuthPatternAnalysis['migrationOpportunities'][0] | null {
    
    if (pattern === 'require-member-access') {
      return {
        line: call.getStartLineNumber(),
        current: 'requireMemberAccess()',
        suggested: 'getRequestAuthContext() with validation',
        confidence: 'high',
      };
    }
    
    if (pattern === 'organization-context') {
      return {
        line: call.getStartLineNumber(),
        current: 'getOrganizationContext()',
        suggested: 'getRequestAuthContext()',
        confidence: 'medium',
      };
    }
    
    return null;
  }

  private findUnusedImports(sourceFile: SourceFile): string[] {
    const unused: string[] = [];
    
    sourceFile.getImportDeclarations().forEach(importDecl => {
      importDecl.getNamedImports().forEach(namedImport => {
        const identifier = namedImport.getName();
        const references = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier)
          .filter(id => id.getText() === identifier && id !== namedImport.getNameNode());
        
        if (references.length === 0) {
          unused.push(identifier);
        }
      });
    });
    
    return unused;
  }
}

/**
 * Transformation validator for ensuring safe code changes
 */
export class TransformationValidator {
  private project: Project;
  
  constructor(project: Project) {
    this.project = project;
  }

  /**
   * Validate syntax of a source file
   */
  validateSyntax(sourceFile: SourceFile): ValidationError[] {
    const errors: ValidationError[] = [];
    
    try {
      // Try to get diagnostics
      const diagnostics = sourceFile.getPreEmitDiagnostics();
      
      diagnostics.forEach(diagnostic => {
        const message = diagnostic.getMessageText();
        const line = diagnostic.getLineNumber();
        
        errors.push({
          message: typeof message === 'string' ? message : message.getMessageText(),
          category: 'syntax',
          severity: diagnostic.getCategory() === 1 ? 'error' : 'warning',
          file: sourceFile.getFilePath(),
          line,
        });
      });
      
    } catch (error) {
      errors.push({
        message: `Syntax validation failed: ${error}`,
        category: 'syntax',
        severity: 'error',
        file: sourceFile.getFilePath(),
      });
    }
    
    return errors;
  }

  /**
   * Validate TypeScript type correctness
   */
  validateTypeIntegrity(sourceFile: SourceFile): ValidationError[] {
    const errors: ValidationError[] = [];
    
    try {
      const typeChecker = this.project.getTypeChecker();
      const diagnostics = sourceFile.getPreEmitDiagnostics();
      
      // Filter for type-related diagnostics
      const typeDiagnostics = diagnostics.filter(d => {
        const message = d.getMessageText();
        const messageText = typeof message === 'string' ? message : message.getMessageText();
        return messageText.toLowerCase().includes('type') || 
               messageText.toLowerCase().includes('property') ||
               messageText.toLowerCase().includes('argument');
      });
      
      typeDiagnostics.forEach(diagnostic => {
        const message = diagnostic.getMessageText();
        const line = diagnostic.getLineNumber();
        
        errors.push({
          message: typeof message === 'string' ? message : message.getMessageText(),
          category: 'type',
          severity: 'error',
          file: sourceFile.getFilePath(),
          line,
        });
      });
      
    } catch (error) {
      errors.push({
        message: `Type validation failed: ${error}`,
        category: 'type',
        severity: 'error',
        file: sourceFile.getFilePath(),
      });
    }
    
    return errors;
  }

  /**
   * Validate import statements
   */
  validateImports(sourceFile: SourceFile): ValidationError[] {
    const errors: ValidationError[] = [];
    
    sourceFile.getImportDeclarations().forEach(importDecl => {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      // Check for relative imports going too many levels up
      if (moduleSpecifier.startsWith('../../../')) {
        errors.push({
          message: `Deep relative import detected: ${moduleSpecifier}. Consider using path aliases.`,
          category: 'import',
          severity: 'warning',
          file: sourceFile.getFilePath(),
          line: importDecl.getStartLineNumber(),
          suggestion: 'Use ~/path aliases instead of deep relative imports',
        });
      }
      
      // Check for imports from deprecated modules
      const deprecatedModules = [
        '@supabase/auth-helpers-nextjs',
        '~/lib/organization-context', // Being phased out
      ];
      
      if (deprecatedModules.some(module => moduleSpecifier.includes(module))) {
        errors.push({
          message: `Import from deprecated module: ${moduleSpecifier}`,
          category: 'import',
          severity: 'warning',
          file: sourceFile.getFilePath(),
          line: importDecl.getStartLineNumber(),
          suggestion: 'Update to use newer import paths',
        });
      }
    });
    
    return errors;
  }
}

/**
 * Factory function to create analyzer with default configuration
 */
export function createASTAnalyzer(config?: ASTAnalysisConfig): ASTAnalyzer {
  return new ASTAnalyzer(config);
}

/**
 * Utility function to analyze auth patterns across multiple files
 */
export async function analyzeAuthPatternsInProject(
  analyzer: ASTAnalyzer,
  filePatterns: string[]
): Promise<AuthPatternAnalysis[]> {
  const results: AuthPatternAnalysis[] = [];
  
  for (const pattern of filePatterns) {
    const files = analyzer.getFilesByPattern(pattern);
    
    for (const file of files) {
      const analysis = analyzer.analyzeAuthPatterns(file);
      if (analysis.authCalls.length > 0 || analysis.migrationOpportunities.length > 0) {
        results.push(analysis);
      }
    }
  }
  
  return results;
}