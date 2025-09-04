/**
 * Phase 0: Complete inventory of legacy authentication functions
 * This file documents all existing auth patterns for systematic migration
 */

export interface LegacyAuthFunction {
  name: string;
  location: string;
  usageCount: number;
  pattern: 'context' | 'requirement' | 'action' | 'supabase' | 'rls';
  description: string;
  callSites: string[];
}

/**
 * Complete inventory of legacy authentication functions
 * Built during Phase 0 for systematic migration planning
 */
export const LEGACY_AUTH_INVENTORY: LegacyAuthFunction[] = [
  // Primary organization context functions
  {
    name: 'getOrganizationContext',
    location: 'src/lib/organization-context.ts:84',
    usageCount: 0, // Will be populated by instrumentation
    pattern: 'context',
    description: 'Returns organization context or null, no throwing',
    callSites: []
  },
  {
    name: 'requireOrganizationContext', 
    location: 'src/lib/organization-context.ts:157',
    usageCount: 0,
    pattern: 'requirement',
    description: 'Requires valid organization context, throws if missing',
    callSites: []
  },
  {
    name: 'requireMemberAccess',
    location: 'src/lib/organization-context.ts:173', 
    usageCount: 0,
    pattern: 'requirement',
    description: 'Primary auth function, heavily used throughout codebase',
    callSites: [
      'src/app/api/search/universal/route.ts:58',
      'src/lib/actions/notification-actions.ts:65,123,194,251',
      'src/lib/actions/organization-actions.ts:72,143',
      'src/app/api/search/suggestions/route.ts:23',
      'src/lib/actions/issue-actions.ts:110,352,430,500,594',
      'src/lib/actions/comment-actions.ts:74,150,213,269',
      'src/lib/actions/admin-actions.ts:97,265,349,429,519',
      'src/lib/actions/machine-actions.ts:71,122,183,236,303,375,442'
    ]
  },
  {
    name: 'getRequestAuthContext',
    location: 'src/lib/organization-context.ts:250',
    usageCount: 0,
    pattern: 'context', 
    description: 'NEW unified function - target for migration',
    callSites: []
  },

  // Supabase-specific functions
  {
    name: 'requireSupabaseUserContext',
    location: 'src/lib/supabase/server.ts:195',
    usageCount: 0,
    pattern: 'supabase',
    description: 'Supabase user context with organizationId from app_metadata',
    callSites: []
  },
  {
    name: 'getUserWithOrganization',
    location: 'src/lib/supabase/rls-helpers.ts:119',
    usageCount: 0, 
    pattern: 'rls',
    description: 'RLS helper for organization scoping',
    callSites: [
      'src/lib/supabase/multi-tenant-client.ts:65'
    ]
  },

  // Action context functions
  {
    name: 'getActionAuthContext',
    location: 'src/lib/actions/shared.ts:29',
    usageCount: 0,
    pattern: 'action',
    description: 'Server Action authentication context',
    callSites: []
  },
  {
    name: 'getServerAuthContext', 
    location: 'src/lib/actions/shared.ts:50',
    usageCount: 0,
    pattern: 'action',
    description: 'Alias for getActionAuthContext',
    callSites: []
  },
  {
    name: 'getDALAuthContext',
    location: 'src/lib/dal/shared.ts:20', 
    usageCount: 0,
    pattern: 'context',
    description: 'DAL-specific auth context (no organization)',
    callSites: []
  },
  {
    name: 'requireActionAuthContextWithPermission',
    location: 'src/lib/actions/shared.ts:56',
    usageCount: 0,
    pattern: 'action', 
    description: 'Action auth with permission checking',
    callSites: []
  },

  // Upload-specific functions
  {
    name: 'getUploadAuthContext',
    location: 'src/server/auth/uploadAuth.ts:53',
    usageCount: 0,
    pattern: 'context',
    description: 'Upload-specific authentication context',
    callSites: []
  }
];

/**
 * Get function by name (handles duplicates)
 */
export function getLegacyFunction(name: string, location?: string): LegacyAuthFunction | undefined {
  const matches = LEGACY_AUTH_INVENTORY.filter(fn => fn.name === name);
  if (matches.length === 1) return matches[0];
  if (location) return matches.find(fn => fn.location === location);
  return matches[0]; // Return first if no location specified
}

/**
 * Get functions by pattern
 */
export function getFunctionsByPattern(pattern: LegacyAuthFunction['pattern']): LegacyAuthFunction[] {
  return LEGACY_AUTH_INVENTORY.filter(fn => fn.pattern === pattern);
}

/**
 * Get total usage count across all functions
 */
export function getTotalUsageCount(): number {
  return LEGACY_AUTH_INVENTORY.reduce((sum, fn) => sum + fn.usageCount, 0);
}

/**
 * Update usage count for a function
 */
export function updateUsageCount(name: string, location: string, increment = 1): void {
  const fn = getLegacyFunction(name, location);
  if (fn) {
    fn.usageCount += increment;
  }
}

/**
 * Add call site to function
 */
export function addCallSite(name: string, location: string, callSite: string): void {
  const fn = getLegacyFunction(name, location);
  if (fn && !fn.callSites.includes(callSite)) {
    fn.callSites.push(callSite);
  }
}

/**
 * Phase 0 validation: Check for function name collisions
 */
export function validateNoDuplicateNames(): string[] {
  const nameGroups = new Map<string, LegacyAuthFunction[]>();
  
  LEGACY_AUTH_INVENTORY.forEach(fn => {
    const existing = nameGroups.get(fn.name) || [];
    existing.push(fn);
    nameGroups.set(fn.name, existing);
  });
  
  const collisions: string[] = [];
  nameGroups.forEach((functions, name) => {
    if (functions.length > 1) {
      const locations = functions.map(fn => fn.location).join(', ');
      collisions.push(`${name}: ${locations}`);
    }
  });
  
  return collisions;
}

/**
 * Phase 0 summary report
 */
export function generateInventoryReport(): string {
  const report = [
    '=== PHASE 0: Legacy Authentication Function Inventory ===',
    `Total functions: ${LEGACY_AUTH_INVENTORY.length}`,
    `Total estimated usage: ${getTotalUsageCount()}`,
    '',
    'Functions by pattern:',
    ...Object.entries(
      LEGACY_AUTH_INVENTORY.reduce<Record<string, number>>((acc, fn) => {
        acc[fn.pattern] = (acc[fn.pattern] || 0) + 1;
        return acc;
      }, {})
    ).map(([pattern, count]) => `  ${pattern}: ${count} functions`),
    '',
    'Function name collisions:',
    ...validateNoDuplicateNames().map(collision => `  ❌ ${collision}`),
    '',
    'High-usage functions (estimated):',
    ...LEGACY_AUTH_INVENTORY
      .filter(fn => fn.callSites.length > 5)
      .map(fn => `  ${fn.name}: ${fn.callSites.length} call sites`)
  ];
  
  return report.join('\n');
}