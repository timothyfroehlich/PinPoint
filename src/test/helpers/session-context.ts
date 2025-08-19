/**
 * Session Context Management for RLS Testing
 * 
 * Provides comprehensive session context helpers for setting organizational and user context
 * in RLS-aware tests. These helpers set PostgreSQL session variables that RLS policies
 * read to determine access boundaries.
 * 
 * @see docs/testing/dual-track-testing-strategy.md
 */

import { sql } from "drizzle-orm";
import type { TestDatabase } from "./pglite-test-setup";

/**
 * Core session context setter
 * 
 * Sets PostgreSQL session variables that RLS policies use for access control.
 * All other session helpers build on top of this foundation.
 * 
 * @param db - Test database instance
 * @param orgId - Organization ID for RLS context
 * @param userId - Optional user ID for RLS context  
 * @param role - Optional user role for RLS context
 * @param additionalContext - Optional additional context variables
 */
export async function setTestSession(
  db: TestDatabase,
  orgId: string,
  userId?: string,
  role?: string,
  additionalContext?: Record<string, string>,
): Promise<void> {
  // Primary organizational context (required for all RLS policies)
  await db.execute(sql`SET app.current_organization_id = ${orgId}`);

  // User context (for user-specific RLS policies)
  if (userId) {
    await db.execute(sql`SET app.current_user_id = ${userId}`);
  }

  // Role context (for permission-based RLS policies)
  if (role) {
    await db.execute(sql`SET app.current_user_role = ${role}`);
  }

  // Additional context variables
  if (additionalContext) {
    for (const [key, value] of Object.entries(additionalContext)) {
      await db.execute(sql.raw(`SET app.${key} = '${value}'`));
    }
  }
}

/**
 * Get current session context
 * 
 * Retrieves the currently set session context variables.
 * Useful for debugging and verification.
 * 
 * @param db - Test database instance
 * @returns Current session context
 */
export async function getCurrentSession(db: TestDatabase): Promise<{
  organizationId: string | null;
  userId: string | null;
  role: string | null;
  environment: string | null;
}> {
  try {
    const [orgResult] = await db.execute(sql`SELECT current_setting('app.current_organization_id', true) as value`);
    const [userResult] = await db.execute(sql`SELECT current_setting('app.current_user_id', true) as value`);
    const [roleResult] = await db.execute(sql`SELECT current_setting('app.current_user_role', true) as value`);
    const [envResult] = await db.execute(sql`SELECT current_setting('app.environment', true) as value`);
    
    return {
      organizationId: (orgResult as any)?.value || null,
      userId: (userResult as any)?.value || null,
      role: (roleResult as any)?.value || null,
      environment: (envResult as any)?.value || null,
    };
  } catch {
    return {
      organizationId: null,
      userId: null,
      role: null,
      environment: null,
    };
  }
}

/**
 * Clear all session context
 * 
 * Resets all session variables to their defaults.
 * Useful for test cleanup or switching to anonymous context.
 * 
 * @param db - Test database instance
 */
export async function clearTestSession(db: TestDatabase): Promise<void> {
  const sessionVars = [
    'app.current_organization_id',
    'app.current_user_id', 
    'app.current_user_role',
    'app.test_mode',
    'app.test_role',
  ];
  
  for (const variable of sessionVars) {
    try {
      await db.execute(sql.raw(`SET ${variable} = DEFAULT`));
    } catch {
      // Ignore errors for variables that don't exist
    }
  }
}

/**
 * Pre-configured session contexts for common test scenarios
 * 
 * These helpers provide standard session contexts for typical testing needs.
 * All helpers are async and should be awaited.
 */
export const testSessions = {
  /**
   * Admin user context - full organizational access
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param userId - Optional user ID (defaults to admin-user)
   */
  admin: async (
    db: TestDatabase, 
    orgId: string, 
    userId: string = "admin-user"
  ): Promise<void> => {
    await setTestSession(db, orgId, userId, "admin", {
      permissions: "all",
      access_level: "admin",
    });
  },

  /**
   * Member user context - standard organizational access
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param userId - Optional user ID (defaults to member-user)
   */
  member: async (
    db: TestDatabase, 
    orgId: string, 
    userId: string = "member-user"
  ): Promise<void> => {
    await setTestSession(db, orgId, userId, "member", {
      permissions: "standard",
      access_level: "member",
    });
  },

  /**
   * Viewer/Guest user context - read-only access
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param userId - Optional user ID (defaults to viewer-user)
   */
  viewer: async (
    db: TestDatabase, 
    orgId: string, 
    userId: string = "viewer-user"
  ): Promise<void> => {
    await setTestSession(db, orgId, userId, "viewer", {
      permissions: "read",
      access_level: "viewer",
    });
  },

  /**
   * Anonymous context - only organizational scoping, no user
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   */
  anonymous: async (db: TestDatabase, orgId: string): Promise<void> => {
    await setTestSession(db, orgId, undefined, "anonymous", {
      permissions: "none",
      access_level: "anonymous",
    });
  },

  /**
   * Owner context - user with ownership permissions
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param userId - User ID who owns resources
   */
  owner: async (
    db: TestDatabase, 
    orgId: string, 
    userId: string
  ): Promise<void> => {
    await setTestSession(db, orgId, userId, "owner", {
      permissions: "owner",
      access_level: "owner",
      is_owner: "true",
    });
  },

  /**
   * Service account context - system-level operations
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param serviceId - Service account identifier
   */
  service: async (
    db: TestDatabase, 
    orgId: string, 
    serviceId: string = "test-service"
  ): Promise<void> => {
    await setTestSession(db, orgId, serviceId, "service", {
      permissions: "system",
      access_level: "service",
      account_type: "service",
    });
  },

  /**
   * Cross-organization testing - switch between organizations
   * 
   * @param db - Test database instance
   * @param newOrgId - New organization ID to switch to
   */
  switchOrganization: async (db: TestDatabase, newOrgId: string): Promise<void> => {
    const currentSession = await getCurrentSession(db);
    await setTestSession(
      db, 
      newOrgId, 
      currentSession.userId || undefined,
      currentSession.role || undefined
    );
  },

  /**
   * Impersonation context - admin acting as another user
   * 
   * @param db - Test database instance  
   * @param orgId - Organization ID
   * @param adminId - Admin user performing impersonation
   * @param targetUserId - User being impersonated
   */
  impersonate: async (
    db: TestDatabase,
    orgId: string,
    adminId: string,
    targetUserId: string
  ): Promise<void> => {
    await setTestSession(db, orgId, targetUserId, "member", {
      impersonated_by: adminId,
      impersonation: "true",
      access_level: "impersonated",
    });
  },
} as const;

/**
 * Multi-context session manager for complex testing scenarios
 * 
 * Useful for tests that need to switch between multiple user contexts
 * or organizations during the same test.
 */
export class MultiContextManager {
  private contexts: Array<{
    id: string;
    orgId: string;
    userId?: string;
    role?: string;
    additionalContext?: Record<string, string>;
  }> = [];
  
  constructor(private db: TestDatabase) {}
  
  /**
   * Add a context configuration
   * 
   * @param id - Unique identifier for this context
   * @param orgId - Organization ID
   * @param userId - Optional user ID
   * @param role - Optional user role  
   * @param additionalContext - Optional additional context
   */
  addContext(
    id: string,
    orgId: string,
    userId?: string,
    role?: string,
    additionalContext?: Record<string, string>
  ): void {
    this.contexts.push({ id, orgId, userId, role, additionalContext });
  }
  
  /**
   * Switch to a previously added context
   * 
   * @param contextId - ID of the context to switch to
   */
  async switchTo(contextId: string): Promise<void> {
    const context = this.contexts.find(c => c.id === contextId);
    if (!context) {
      throw new Error(`Context '${contextId}' not found. Available contexts: ${this.contexts.map(c => c.id).join(', ')}`);
    }
    
    await setTestSession(
      this.db,
      context.orgId,
      context.userId,
      context.role,
      context.additionalContext
    );
  }
  
  /**
   * Get list of available context IDs
   * 
   * @returns Array of context identifiers
   */
  getContextIds(): string[] {
    return this.contexts.map(c => c.id);
  }
  
  /**
   * Clear all stored contexts
   */
  clearContexts(): void {
    this.contexts = [];
  }
}

/**
 * Session context verification helpers
 * 
 * These functions help verify that session context is set correctly
 * and that RLS policies are responding as expected.
 */
export const sessionVerification = {
  /**
   * Verify that session context is set correctly
   * 
   * @param db - Test database instance
   * @param expected - Expected session values
   */
  async verifySessionContext(
    db: TestDatabase,
    expected: {
      organizationId?: string;
      userId?: string;
      role?: string;
    }
  ): Promise<boolean> {
    const current = await getCurrentSession(db);
    
    return (
      (!expected.organizationId || current.organizationId === expected.organizationId) &&
      (!expected.userId || current.userId === expected.userId) &&
      (!expected.role || current.role === expected.role)
    );
  },

  /**
   * Assert that session context matches expected values
   * 
   * @param db - Test database instance
   * @param expected - Expected session values
   * @throws Error if session context doesn't match
   */
  async assertSessionContext(
    db: TestDatabase,
    expected: {
      organizationId?: string;
      userId?: string;
      role?: string;
    }
  ): Promise<void> {
    const isValid = await this.verifySessionContext(db, expected);
    if (!isValid) {
      const current = await getCurrentSession(db);
      throw new Error(
        `Session context mismatch:\n` +
        `Expected: ${JSON.stringify(expected, null, 2)}\n` +
        `Actual: ${JSON.stringify(current, null, 2)}`
      );
    }
  },

  /**
   * Verify organizational isolation is working
   * 
   * Tests that switching organizational context properly isolates data.
   * 
   * @param db - Test database instance
   * @param org1Id - First organization ID
   * @param org2Id - Second organization ID
   * @param testQuery - Query function that should return org-specific data
   */
  async verifyOrganizationalIsolation(
    db: TestDatabase,
    org1Id: string,
    org2Id: string,
    testQuery: (db: TestDatabase) => Promise<any[]>
  ): Promise<boolean> {
    // Set context to org1 and get data
    await testSessions.admin(db, org1Id);
    const org1Data = await testQuery(db);
    
    // Set context to org2 and get data
    await testSessions.admin(db, org2Id);
    const org2Data = await testQuery(db);
    
    // Verify no overlap in data
    const org1Ids = org1Data.map(item => item.id || item);
    const org2Ids = org2Data.map(item => item.id || item);
    
    const hasOverlap = org1Ids.some(id => org2Ids.includes(id));
    return !hasOverlap;
  },
};

/**
 * Common session patterns for specific test scenarios
 * 
 * These are higher-level helpers that combine session management
 * with common testing patterns.
 */
export const sessionPatterns = {
  /**
   * Test with admin privileges
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param testFn - Test function to run with admin context
   */
  async withAdmin<T>(
    db: TestDatabase,
    orgId: string,
    testFn: (db: TestDatabase) => Promise<T>
  ): Promise<T> {
    await testSessions.admin(db, orgId);
    return await testFn(db);
  },

  /**
   * Test with member privileges
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param testFn - Test function to run with member context
   */
  async withMember<T>(
    db: TestDatabase,
    orgId: string,
    testFn: (db: TestDatabase) => Promise<T>
  ): Promise<T> {
    await testSessions.member(db, orgId);
    return await testFn(db);
  },

  /**
   * Test across multiple roles
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param roles - Array of roles to test
   * @param testFn - Test function that receives role name
   */
  async withMultipleRoles<T>(
    db: TestDatabase,
    orgId: string,
    roles: Array<keyof typeof testSessions>,
    testFn: (db: TestDatabase, role: string) => Promise<T>
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (const role of roles) {
      if (typeof testSessions[role] === 'function' && role !== 'switchOrganization' && role !== 'impersonate') {
        await (testSessions[role] as any)(db, orgId);
        const result = await testFn(db, role);
        results.push(result);
      }
    }
    
    return results;
  },

  /**
   * Test permission escalation scenario
   * 
   * @param db - Test database instance
   * @param orgId - Organization ID
   * @param testFn - Test function that receives context switcher
   */
  async withEscalation<T>(
    db: TestDatabase,
    orgId: string,
    testFn: (
      escalate: (to: 'member' | 'admin') => Promise<void>,
      db: TestDatabase
    ) => Promise<T>
  ): Promise<T> {
    // Start with member context
    await testSessions.member(db, orgId);
    
    const escalate = async (to: 'member' | 'admin') => {
      await testSessions[to](db, orgId);
    };
    
    return await testFn(escalate, db);
  },
};

/**
 * Session debugging utilities
 * 
 * Helpers for debugging session context issues during test development.
 */
export const sessionDebug = {
  /**
   * Log current session context
   * 
   * @param db - Test database instance
   * @param label - Optional label for the log output
   */
  async logCurrentSession(db: TestDatabase, label?: string): Promise<void> {
    const session = await getCurrentSession(db);
    const prefix = label ? `[${label}]` : '[Session]';
    console.log(`${prefix} Current session context:`, session);
  },

  /**
   * Validate session context setup
   * 
   * @param db - Test database instance
   * @returns Validation results
   */
  async validateSetup(db: TestDatabase): Promise<{
    isValid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const session = await getCurrentSession(db);
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    if (!session.organizationId) {
      issues.push('No organization ID set');
      recommendations.push('Set organization context with testSessions.admin() or similar');
    }
    
    if (!session.userId && session.role !== 'anonymous') {
      issues.push('No user ID set for non-anonymous role');
      recommendations.push('Provide userId parameter to session helpers');
    }
    
    if (!session.role) {
      issues.push('No role set');
      recommendations.push('Use testSessions helpers to set appropriate role');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  },
};

// Export types for convenience
export type SessionContext = Awaited<ReturnType<typeof getCurrentSession>>;
export type SessionRole = keyof typeof testSessions;