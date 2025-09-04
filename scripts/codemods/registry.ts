/**
 * Codemod Registry System - Phase 0 Infrastructure
 * Central catalog and management system for all available codemods
 * 
 * This module provides:
 * - Codemod manifest system with metadata
 * - Dependency tracking and resolution
 * - Version management
 * - Risk assessment and categorization
 * - Execution ordering and prerequisites
 */

/**
 * Codemod manifest defining all metadata for a transformation
 */
export interface CodemodManifest {
  /** Unique identifier for the codemod */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description of what the codemod does */
  description: string;
  
  /** Version using semantic versioning */
  version: string;
  
  /** File patterns this codemod targets */
  targetPatterns: string[];
  
  /** Codemod IDs that must be run before this one */
  dependencies: string[];
  
  /** Path to the transformation file (relative to codemods directory) */
  transformFile: string;
  
  /** Path to test file for this codemod */
  testFile?: string;
  
  /** Whether this codemod supports dry-run analysis */
  dryRunSupport: boolean;
  
  /** Whether this codemod supports rollback */
  rollbackSupport: boolean;
  
  /** Risk level assessment */
  estimatedRisk: 'low' | 'medium' | 'high' | 'critical';
  
  /** Parser type for jscodeshift */
  parser: 'babel' | 'tsx' | 'ts' | 'flow';
  
  /** Category for organization */
  category: 'auth' | 'dal' | 'ui' | 'performance' | 'migration' | 'cleanup' | 'other';
  
  /** Tags for searchability */
  tags: string[];
  
  /** Author information */
  author?: string;
  
  /** Creation date */
  createdAt: Date;
  
  /** Last update date */
  updatedAt: Date;
  
  /** Minimum Node.js version required */
  nodeVersion?: string;
  
  /** Required dependencies (npm packages) */
  requiredDependencies?: string[];
  
  /** Optional configuration schema */
  configSchema?: Record<string, any>;
  
  /** Usage examples */
  examples?: string[];
  
  /** Known limitations or issues */
  limitations?: string[];
  
  /** Performance characteristics */
  performance?: {
    /** Estimated files per second processing rate */
    filesPerSecond?: number;
    /** Memory usage estimate in MB */
    memoryUsageMB?: number;
    /** Whether it's CPU intensive */
    cpuIntensive?: boolean;
  };
}

/**
 * Registry of all available codemods
 */
export const CODEMOD_REGISTRY: Record<string, CodemodManifest> = {
  'migrate-dal-functions': {
    id: 'migrate-dal-functions',
    name: 'DAL Function Migration',
    description: 'Migrate DAL functions from ensureOrgContextAndBindRLS to withOrgRLS pattern with explicit organizationId parameters',
    version: '1.0.0',
    targetPatterns: ['src/lib/dal/*.ts'],
    dependencies: [], // No dependencies
    transformFile: 'migrate-dal-functions.ts',
    testFile: 'migrate-dal-functions.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'medium',
    parser: 'tsx',
    category: 'dal',
    tags: ['database', 'organization', 'rls', 'context'],
    author: 'PinPoint Team',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    nodeVersion: '>=18.0.0',
    requiredDependencies: ['jscodeshift'],
    examples: [
      'tsx scripts/codemods/runner.ts run migrate-dal-functions --dry-run',
      'tsx scripts/codemods/runner.ts run migrate-dal-functions --batch-size=5',
    ],
    limitations: [
      'Does not handle complex context usage beyond context.organization.id',
      'Requires manual review for context.user references',
    ],
    performance: {
      filesPerSecond: 10,
      memoryUsageMB: 50,
      cpuIntensive: false,
    },
  },

  'migrate-require-member-access': {
    id: 'migrate-require-member-access',
    name: 'requireMemberAccess Migration',
    description: 'Migrate requireMemberAccess calls to getRequestAuthContext pattern with proper error handling',
    version: '1.0.0',
    targetPatterns: ['src/lib/actions/*.ts', 'src/app/**/page.tsx'],
    dependencies: ['migrate-dal-functions'], // Run after DAL migration
    transformFile: 'migrate-require-member-access.ts', // To be created in Wave 1
    testFile: 'migrate-require-member-access.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'high',
    parser: 'tsx',
    category: 'auth',
    tags: ['authentication', 'authorization', 'context', 'migration'],
    author: 'PinPoint Team',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    nodeVersion: '>=18.0.0',
    requiredDependencies: ['jscodeshift', 'ts-morph'],
    examples: [
      'tsx scripts/codemods/runner.ts run migrate-require-member-access --dry-run --max-files=5',
    ],
    limitations: [
      'Requires manual review for complex destructuring patterns',
      'May need adjustment for custom error handling',
    ],
    performance: {
      filesPerSecond: 5,
      memoryUsageMB: 75,
      cpuIntensive: true,
    },
  },

  'migrate-organization-context': {
    id: 'migrate-organization-context',
    name: 'Organization Context Migration',
    description: 'Migrate getOrganizationContext calls to getRequestAuthContext pattern in Server Components',
    version: '1.0.0',
    targetPatterns: ['src/app/**/page.tsx', 'src/components/**/*.tsx'],
    dependencies: ['migrate-require-member-access'], // Run after auth migration
    transformFile: 'migrate-organization-context.ts', // To be created
    testFile: 'migrate-organization-context.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'medium',
    parser: 'tsx',
    category: 'auth',
    tags: ['server-components', 'organization', 'context', 'nextjs'],
    author: 'PinPoint Team',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    nodeVersion: '>=18.0.0',
    requiredDependencies: ['jscodeshift', 'ts-morph'],
    examples: [
      'tsx scripts/codemods/runner.ts run migrate-organization-context --dry-run',
    ],
    limitations: [
      'Server Components require careful handling of async patterns',
      'May affect redirect logic and error handling',
    ],
    performance: {
      filesPerSecond: 8,
      memoryUsageMB: 60,
      cpuIntensive: false,
    },
  },

  'cleanup-unused-imports': {
    id: 'cleanup-unused-imports',
    name: 'Unused Import Cleanup',
    description: 'Remove unused imports and consolidate import statements after auth migration',
    version: '1.0.0',
    targetPatterns: ['src/**/*.ts', 'src/**/*.tsx'],
    dependencies: ['migrate-organization-context'], // Run last
    transformFile: 'cleanup-unused-imports.ts', // To be created
    testFile: 'cleanup-unused-imports.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'low',
    parser: 'tsx',
    category: 'cleanup',
    tags: ['imports', 'cleanup', 'optimization'],
    author: 'PinPoint Team',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    nodeVersion: '>=18.0.0',
    requiredDependencies: ['ts-morph'],
    examples: [
      'tsx scripts/codemods/runner.ts run cleanup-unused-imports --dry-run',
    ],
    limitations: [
      'May not detect all unused imports in complex scenarios',
    ],
    performance: {
      filesPerSecond: 15,
      memoryUsageMB: 40,
      cpuIntensive: false,
    },
  },

  'add-cache-wrappers': {
    id: 'add-cache-wrappers',
    name: 'Cache Wrapper Addition',
    description: 'Add React cache() wrappers to server-side data fetching functions for performance optimization',
    version: '1.0.0',
    targetPatterns: ['src/lib/dal/*.ts', 'src/lib/actions/*.ts'],
    dependencies: ['migrate-dal-functions'],
    transformFile: 'add-cache-wrappers.ts', // To be created in Wave 3
    testFile: 'add-cache-wrappers.test.ts',
    dryRunSupport: true,
    rollbackSupport: true,
    estimatedRisk: 'medium',
    parser: 'tsx',
    category: 'performance',
    tags: ['cache', 'performance', 'react', 'server-components'],
    author: 'PinPoint Team',
    createdAt: new Date('2024-12-01'),
    updatedAt: new Date('2024-12-01'),
    nodeVersion: '>=18.0.0',
    requiredDependencies: ['jscodeshift', 'ts-morph'],
    examples: [
      'tsx scripts/codemods/runner.ts run add-cache-wrappers --dry-run',
    ],
    limitations: [
      'Requires careful analysis to avoid over-caching',
      'May need manual review for complex data dependencies',
    ],
    performance: {
      filesPerSecond: 12,
      memoryUsageMB: 55,
      cpuIntensive: false,
    },
  },
};

/**
 * Codemod categories for organization
 */
export const CODEMOD_CATEGORIES = {
  auth: 'Authentication & Authorization',
  dal: 'Data Access Layer',
  ui: 'User Interface',
  performance: 'Performance Optimization',
  migration: 'Architecture Migration',
  cleanup: 'Code Cleanup',
  other: 'Other',
} as const;

/**
 * Registry manager for codemod operations
 */
export class RegistryManager {
  private registry: Record<string, CodemodManifest>;
  
  constructor(registry: Record<string, CodemodManifest> = CODEMOD_REGISTRY) {
    this.registry = registry;
  }

  /**
   * List all available codemods
   */
  listAvailableCodemods(): CodemodManifest[] {
    return Object.values(this.registry).sort((a, b) => 
      a.name.localeCompare(b.name)
    );
  }

  /**
   * Get a specific codemod by ID
   */
  getCodemod(id: string): CodemodManifest | undefined {
    return this.registry[id];
  }

  /**
   * Get codemods by category
   */
  getCodemodsByCategory(category: CodemodManifest['category']): CodemodManifest[] {
    return Object.values(this.registry)
      .filter(codemod => codemod.category === category)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Search codemods by tags or keywords
   */
  searchCodemods(query: string): CodemodManifest[] {
    const searchTerms = query.toLowerCase().split(' ');
    
    return Object.values(this.registry).filter(codemod => {
      const searchableText = [
        codemod.name,
        codemod.description,
        ...codemod.tags,
        codemod.category,
      ].join(' ').toLowerCase();
      
      return searchTerms.every(term => searchableText.includes(term));
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get dependencies for a codemod (recursive)
   */
  getCodemodDependencies(codemodId: string): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    
    const collectDependencies = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const codemod = this.registry[id];
      if (!codemod) return;
      
      codemod.dependencies.forEach(depId => {
        collectDependencies(depId);
        if (!result.includes(depId)) {
          result.push(depId);
        }
      });
    };
    
    collectDependencies(codemodId);
    return result;
  }

  /**
   * Validate that a codemod exists
   */
  validateCodemodExists(codemodId: string): boolean {
    return codemodId in this.registry;
  }

  /**
   * Plan execution order for multiple codemods
   */
  planExecutionOrder(codemodIds: string[]): string[] {
    const orderedIds: string[] = [];
    const processing = new Set<string>();
    
    const addCodemodWithDeps = (id: string) => {
      if (orderedIds.includes(id) || processing.has(id)) {
        return;
      }
      
      processing.add(id);
      
      const codemod = this.registry[id];
      if (!codemod) {
        throw new Error(`Unknown codemod: ${id}`);
      }
      
      // Add dependencies first
      codemod.dependencies.forEach(depId => {
        addCodemodWithDeps(depId);
      });
      
      orderedIds.push(id);
      processing.delete(id);
    };
    
    codemodIds.forEach(id => addCodemodWithDeps(id));
    
    return orderedIds;
  }

  /**
   * Validate execution prerequisites
   */
  validateExecutionPrerequisites(codemodId: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    const codemod = this.registry[codemodId];
    
    if (!codemod) {
      return {
        valid: false,
        issues: [`Codemod not found: ${codemodId}`],
      };
    }
    
    // Check dependencies exist
    codemod.dependencies.forEach(depId => {
      if (!this.registry[depId]) {
        issues.push(`Dependency not found: ${depId}`);
      }
    });
    
    // Note: Transform file validation is handled during execution
    // to avoid ES module import complexity in registry validation
    
    // Check Node.js version if specified
    if (codemod.nodeVersion) {
      const currentVersion = process.version;
      // Simple version check (could be enhanced with semver)
      if (codemod.nodeVersion.includes('>=') && currentVersion < codemod.nodeVersion.replace('>=', '')) {
        issues.push(`Node.js version ${codemod.nodeVersion} required, current: ${currentVersion}`);
      }
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get codemods by risk level
   */
  getCodemodsByRisk(riskLevel: CodemodManifest['estimatedRisk']): CodemodManifest[] {
    return Object.values(this.registry)
      .filter(codemod => codemod.estimatedRisk === riskLevel)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get performance statistics for all codemods
   */
  getPerformanceStatistics(): {
    totalCodemods: number;
    averageFilesPerSecond: number;
    totalMemoryUsage: number;
    cpuIntensiveCount: number;
  } {
    const codemods = Object.values(this.registry);
    const withPerformance = codemods.filter(c => c.performance);
    
    return {
      totalCodemods: codemods.length,
      averageFilesPerSecond: withPerformance.reduce((sum, c) => 
        sum + (c.performance?.filesPerSecond || 0), 0) / withPerformance.length,
      totalMemoryUsage: withPerformance.reduce((sum, c) => 
        sum + (c.performance?.memoryUsageMB || 0), 0),
      cpuIntensiveCount: withPerformance.filter(c => c.performance?.cpuIntensive).length,
    };
  }

  /**
   * Generate registry report
   */
  generateRegistryReport(): string {
    const codemods = this.listAvailableCodemods();
    const stats = this.getPerformanceStatistics();
    
    const report = [
      '# Codemod Registry Report',
      '',
      `**Total Codemods:** ${stats.totalCodemods}`,
      `**Average Processing Speed:** ${stats.averageFilesPerSecond.toFixed(1)} files/second`,
      `**CPU Intensive Codemods:** ${stats.cpuIntensiveCount}`,
      '',
      '## Available Codemods',
      '',
    ];
    
    // Group by category
    const byCategory = codemods.reduce((acc, codemod) => {
      if (!acc[codemod.category]) {
        acc[codemod.category] = [];
      }
      acc[codemod.category].push(codemod);
      return acc;
    }, {} as Record<string, CodemodManifest[]>);
    
    Object.entries(byCategory).forEach(([category, categoryCodemods]) => {
      report.push(`### ${CODEMOD_CATEGORIES[category as keyof typeof CODEMOD_CATEGORIES] || category}`);
      report.push('');
      
      categoryCodemods.forEach(codemod => {
        const riskEmoji = codemod.estimatedRisk === 'low' ? '🟢' :
                         codemod.estimatedRisk === 'medium' ? '🟡' :
                         codemod.estimatedRisk === 'high' ? '🟠' : '🔴';
        
        report.push(`#### ${riskEmoji} ${codemod.name} (${codemod.id})`);
        report.push(`**Version:** ${codemod.version} | **Risk:** ${codemod.estimatedRisk}`);
        report.push(`**Dependencies:** ${codemod.dependencies.length > 0 ? codemod.dependencies.join(', ') : 'None'}`);
        report.push('');
        report.push(codemod.description);
        report.push('');
        
        if (codemod.examples && codemod.examples.length > 0) {
          report.push('**Usage:**');
          report.push('```bash');
          report.push(codemod.examples[0]);
          report.push('```');
          report.push('');
        }
      });
    });
    
    // Dependency graph
    report.push('## Dependency Graph');
    report.push('');
    codemods.forEach(codemod => {
      if (codemod.dependencies.length > 0) {
        report.push(`- **${codemod.id}** depends on: ${codemod.dependencies.join(', ')}`);
      }
    });
    
    return report.join('\n');
  }

  /**
   * Add or update a codemod in the registry
   */
  registerCodemod(manifest: CodemodManifest): void {
    this.registry[manifest.id] = {
      ...manifest,
      updatedAt: new Date(),
    };
  }

  /**
   * Remove a codemod from the registry
   */
  unregisterCodemod(codemodId: string): boolean {
    if (this.registry[codemodId]) {
      delete this.registry[codemodId];
      return true;
    }
    return false;
  }
}

/**
 * Factory function for creating registry manager
 */
export function createRegistryManager(registry?: Record<string, CodemodManifest>): RegistryManager {
  return new RegistryManager(registry);
}

/**
 * Default registry manager instance
 */
export const defaultRegistryManager = createRegistryManager();