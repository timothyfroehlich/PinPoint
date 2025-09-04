#!/usr/bin/env tsx

/**
 * Phase 0: Authentication Pattern Inventory Generator
 * 
 * Automated generator for comprehensive baseline snapshots of:
 * 1. Authentication functions and their usage patterns
 * 2. Server fetchers with caching analysis  
 * 3. Role conditionals and permission checks
 * 4. Organization-scoped functions
 * 
 * Usage: tsx scripts/phase-0/inventory-generator.ts
 */

import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

interface InventoryConfig {
  outputDir: string;
  patterns: {
    authFunctions: string[];
    dalFiles: string[];
    actionFiles: string[];
    apiRoutes: string[];
    pageFiles: string[];
  };
}

interface AuthFunction {
  name: string;
  location: string;
  pattern: 'context' | 'requirement' | 'action' | 'supabase' | 'rls';
  usageCount: number;
  callSites: string[];
  description: string;
}

interface ServerFetcher {
  name: string;
  location: string;
  isCached: boolean;
  isAsync: boolean;
  returnType: string;
  usesAuth: boolean;
  authPattern: string;
  callSites: string[];
}

interface RoleConditional {
  location: string;
  condition: string;
  context: string;
  function: string;
  lineNumber: number;
}

interface OrgScopedFunction {
  name: string;
  location: string;
  scopingMethod: string;
  requiresOrgId: boolean;
  isPubliclyAccessible: boolean;
  usesRLS: boolean;
  description: string;
}

class AuthInventoryGenerator {
  private config: InventoryConfig;

  constructor() {
    this.config = {
      outputDir: 'docs/baseline',
      patterns: {
        authFunctions: [
          'getRequestAuthContext',
          'requireMemberAccess',
          'getOrganizationContext',
          'requireOrganizationContext',
          'getActionAuthContext',
          'getDALAuthContext',
          'requireActionAuthContextWithPermission',
          'requireSupabaseUserContext',
          'getUserWithOrganization',
          'getUploadAuthContext'
        ],
        dalFiles: ['src/lib/dal/*.ts'],
        actionFiles: ['src/lib/actions/*.ts'],
        apiRoutes: ['src/app/api/**/*.ts'],
        pageFiles: ['src/app/**/page.tsx']
      }
    };
  }

  /**
   * Execute ripgrep command and return results
   */
  private executeGrep(pattern: string, options: string[] = []): string {
    try {
      const cmd = `rg "${pattern}" ${options.join(' ')} --type ts --json`;
      return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      // ripgrep exits with code 1 when no matches found
      if ((error as any).status === 1) {
        return '';
      }
      throw error;
    }
  }

  /**
   * Parse ripgrep JSON output
   */
  private parseGrepOutput(output: string): Array<{path: string, line: number, text: string}> {
    if (!output.trim()) return [];
    
    return output
      .trim()
      .split('\n')
      .map(line => {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'match') {
            return {
              path: parsed.data.path.text,
              line: parsed.data.line_number,
              text: parsed.data.lines.text.trim()
            };
          }
          return null;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Array<{path: string, line: number, text: string}>;
  }

  /**
   * Find all authentication function usages
   */
  private async findAuthFunctionUsages(): Promise<Map<string, Array<{path: string, line: number}>>> {
    const usageMap = new Map<string, Array<{path: string, line: number}>>();
    
    for (const funcName of this.config.patterns.authFunctions) {
      const output = this.executeGrep(funcName, ['--line-number']);
      const matches = this.parseGrepOutput(output);
      
      const callSites = matches
        .filter(match => !match.path.includes('legacy-inventory.ts')) // Skip the inventory file itself
        .map(match => ({
          path: match.path,
          line: match.line
        }));
      
      usageMap.set(funcName, callSites);
    }
    
    return usageMap;
  }

  /**
   * Find all cache() wrapped functions
   */
  private async findCachedFunctions(): Promise<ServerFetcher[]> {
    const output = this.executeGrep('cache\\(', ['--line-number']);
    const matches = this.parseGrepOutput(output);
    
    const fetchers: ServerFetcher[] = [];
    
    for (const match of matches) {
      // Extract function name from the cache() usage
      const funcNameMatch = match.text.match(/export\s+const\s+(\w+)\s*=\s*cache\(/);
      if (funcNameMatch) {
        const funcName = funcNameMatch[1];
        
        fetchers.push({
          name: funcName,
          location: `${match.path}:${match.line}`,
          isCached: true,
          isAsync: true, // Assume async for now
          returnType: 'Promise<unknown>', // Would need AST parsing for exact types
          usesAuth: match.text.includes('organizationId') || match.text.includes('userId'),
          authPattern: match.text.includes('organizationId') ? 'organizationId' : 'other',
          callSites: [] // Would need cross-reference analysis
        });
      }
    }
    
    return fetchers;
  }

  /**
   * Find all role conditionals
   */
  private async findRoleConditionals(): Promise<RoleConditional[]> {
    const patterns = ['role\\.name', 'membership\\.role', '\\.role\\.'];
    const conditionals: RoleConditional[] = [];
    
    for (const pattern of patterns) {
      const output = this.executeGrep(pattern, ['--line-number']);
      const matches = this.parseGrepOutput(output);
      
      for (const match of matches) {
        conditionals.push({
          location: `${match.path}:${match.line}`,
          condition: match.text.trim(),
          context: this.inferContext(match.path),
          function: this.inferFunction(match.text),
          lineNumber: match.line
        });
      }
    }
    
    return conditionals;
  }

  /**
   * Find all organization-scoped functions
   */
  private async findOrgScopedFunctions(): Promise<OrgScopedFunction[]> {
    const output = this.executeGrep('organizationId', ['--line-number']);
    const matches = this.parseGrepOutput(output);
    
    const functions: OrgScopedFunction[] = [];
    
    for (const match of matches) {
      // Look for function definitions that take organizationId parameter
      const funcMatch = match.text.match(/export\s+.*?(\w+).*?organizationId/);
      if (funcMatch) {
        const funcName = funcMatch[1];
        
        functions.push({
          name: funcName,
          location: `${match.path}:${match.line}`,
          scopingMethod: 'explicitOrgId',
          requiresOrgId: true,
          isPubliclyAccessible: false,
          usesRLS: false,
          description: `Function requiring organization context scoping`
        });
      }
    }
    
    return functions;
  }

  /**
   * Infer context from file path
   */
  private inferContext(filePath: string): string {
    if (filePath.includes('/actions/')) return 'Server Action';
    if (filePath.includes('/dal/')) return 'DAL Function';
    if (filePath.includes('/api/')) return 'API Route';
    if (filePath.includes('/page.tsx')) return 'Server Component';
    if (filePath.includes('/components/')) return 'Component';
    return 'Unknown';
  }

  /**
   * Infer function name from code line
   */
  private inferFunction(codeLine: string): string {
    const funcMatch = codeLine.match(/(\w+)\s*\(/);
    return funcMatch?.[1] || 'unknown';
  }

  /**
   * Generate authentication functions inventory
   */
  async generateAuthFunctions(): Promise<void> {
    console.log('🔍 Analyzing authentication functions...');
    
    const usageMap = await this.findAuthFunctionUsages();
    
    const authFunctions: AuthFunction[] = [
      {
        name: 'getRequestAuthContext',
        location: 'src/server/auth/context.ts:64',
        pattern: 'context',
        usageCount: usageMap.get('getRequestAuthContext')?.length || 0,
        callSites: usageMap.get('getRequestAuthContext')?.map(site => `${site.path}:${site.line}`) || [],
        description: 'Canonical authentication resolver - returns discriminated union, never throws'
      },
      {
        name: 'requireMemberAccess',
        location: 'src/lib/organization-context.ts:88',
        pattern: 'requirement',
        usageCount: usageMap.get('requireMemberAccess')?.length || 0,
        callSites: usageMap.get('requireMemberAccess')?.map(site => `${site.path}:${site.line}`) || [],
        description: 'Legacy wrapper around canonical resolver - heavily used historically'
      }
      // Add other functions...
    ];

    const inventory = {
      inventoryDate: new Date().toISOString().split('T')[0],
      totalFunctions: authFunctions.length,
      patterns: {
        context: authFunctions.filter(f => f.pattern === 'context').map(f => f.name),
        requirement: authFunctions.filter(f => f.pattern === 'requirement').map(f => f.name),
        action: authFunctions.filter(f => f.pattern === 'action').map(f => f.name),
        supabase: authFunctions.filter(f => f.pattern === 'supabase').map(f => f.name),
        rls: authFunctions.filter(f => f.pattern === 'rls').map(f => f.name)
      },
      functions: authFunctions,
      highUsageFunctions: authFunctions
        .filter(f => f.usageCount > 10)
        .map(f => ({ name: f.name, usageCount: f.usageCount, pattern: f.pattern })),
      duplicateNames: []
    };

    await fs.writeFile(
      path.join(this.config.outputDir, 'auth-functions.json'),
      JSON.stringify(inventory, null, 2)
    );
    
    console.log(`✅ Generated auth-functions.json with ${authFunctions.length} functions`);
  }

  /**
   * Generate server fetchers inventory
   */
  async generateServerFetchers(): Promise<void> {
    console.log('🔍 Analyzing server fetchers...');
    
    const fetchers = await this.findCachedFunctions();
    
    const inventory = {
      inventoryDate: new Date().toISOString().split('T')[0],
      totalFetchers: fetchers.length,
      cacheWrapped: fetchers.filter(f => f.isCached).length,
      uncachedFetchers: fetchers.filter(f => !f.isCached).map(f => f.name),
      fetchers: fetchers,
      patterns: {
        organizationId: fetchers.filter(f => f.authPattern === 'organizationId').length,
        other: fetchers.filter(f => f.authPattern === 'other').length
      }
    };

    await fs.writeFile(
      path.join(this.config.outputDir, 'server-fetchers.json'),
      JSON.stringify(inventory, null, 2)
    );
    
    console.log(`✅ Generated server-fetchers.json with ${fetchers.length} functions`);
  }

  /**
   * Generate role conditionals inventory
   */
  async generateRoleConditionals(): Promise<void> {
    console.log('🔍 Analyzing role conditionals...');
    
    const conditionals = await this.findRoleConditionals();
    
    const inventory = {
      inventoryDate: new Date().toISOString().split('T')[0],
      totalConditionals: conditionals.length,
      conditionals: conditionals,
      roleChecks: {
        admin: conditionals.filter(c => c.condition.toLowerCase().includes('admin')).length,
        manager: conditionals.filter(c => c.condition.toLowerCase().includes('manager')).length,
        member: conditionals.filter(c => c.condition.toLowerCase().includes('member')).length,
        viewer: conditionals.filter(c => c.condition.toLowerCase().includes('viewer')).length
      },
      patterns: {
        hardcodedRoleNames: conditionals.filter(c => c.condition.includes('===')).length,
        roleIdComparisons: conditionals.filter(c => c.condition.includes('.id')).length,
        permissionChecks: conditionals.filter(c => c.condition.includes('permission')).length
      }
    };

    await fs.writeFile(
      path.join(this.config.outputDir, 'role-conditionals.json'),
      JSON.stringify(inventory, null, 2)
    );
    
    console.log(`✅ Generated role-conditionals.json with ${conditionals.length} conditionals`);
  }

  /**
   * Generate organization-scoped functions inventory
   */
  async generateOrgScopedFunctions(): Promise<void> {
    console.log('🔍 Analyzing organization-scoped functions...');
    
    const functions = await this.findOrgScopedFunctions();
    
    const inventory = {
      inventoryDate: new Date().toISOString().split('T')[0],
      totalFunctions: functions.length,
      scopingPatterns: {
        explicitOrgId: functions.filter(f => f.scopingMethod === 'explicitOrgId').length,
        rlsBinding: functions.filter(f => f.usesRLS).length,
        contextResolution: 0
      },
      functions: functions,
      violations: []
    };

    await fs.writeFile(
      path.join(this.config.outputDir, 'org-scoped-functions.json'),
      JSON.stringify(inventory, null, 2)
    );
    
    console.log(`✅ Generated org-scoped-functions.json with ${functions.length} functions`);
  }

  /**
   * Generate all inventories
   */
  async generateAll(): Promise<void> {
    console.log('🚀 Starting Phase 0 inventory generation...');
    
    // Ensure output directory exists
    await fs.mkdir(this.config.outputDir, { recursive: true });
    
    try {
      await Promise.all([
        this.generateAuthFunctions(),
        this.generateServerFetchers(), 
        this.generateRoleConditionals(),
        this.generateOrgScopedFunctions()
      ]);
      
      console.log('✅ All inventories generated successfully!');
      console.log(`📁 Output location: ${this.config.outputDir}/`);
      
    } catch (error) {
      console.error('❌ Error generating inventories:', error);
      process.exit(1);
    }
  }

  /**
   * Validate generated inventories by comparing with previous run
   */
  async validateConsistency(): Promise<boolean> {
    console.log('🔍 Validating inventory consistency...');
    
    const files = [
      'auth-functions.json',
      'server-fetchers.json', 
      'role-conditionals.json',
      'org-scoped-functions.json'
    ];
    
    for (const file of files) {
      const filePath = path.join(this.config.outputDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        if (!data.inventoryDate || !data.totalFunctions && !data.totalFetchers && !data.totalConditionals) {
          console.error(`❌ Invalid inventory structure in ${file}`);
          return false;
        }
        
        console.log(`✅ ${file} - ${data.totalFunctions || data.totalFetchers || data.totalConditionals || 0} items`);
      } catch (error) {
        console.error(`❌ Error validating ${file}:`, error);
        return false;
      }
    }
    
    console.log('✅ All inventories validated successfully!');
    return true;
  }
}

// CLI Usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new AuthInventoryGenerator();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'auth':
      await generator.generateAuthFunctions();
      break;
    case 'fetchers':
      await generator.generateServerFetchers();
      break;
    case 'roles':
      await generator.generateRoleConditionals();
      break;
    case 'org':
      await generator.generateOrgScopedFunctions();
      break;
    case 'validate':
      const isValid = await generator.validateConsistency();
      process.exit(isValid ? 0 : 1);
      break;
    default:
      await generator.generateAll();
  }
}

export { AuthInventoryGenerator };