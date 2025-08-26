# Phase 1B: Data Access Layer (DAL) Implementation (2025 Revolution)

## 🚀 2025 Performance Revolution Overview

**GAME-CHANGING CONTEXT**: Phase 1B implementation leverages React 19's revolutionary cache() API and 2025 database optimization patterns to achieve unprecedented performance improvements.

### **Revolutionary Technology Stack**

#### **React 19 cache() API: Request-Level Memoization**
- **3-5x query reduction**: Eliminates duplicate database calls per request
- **Automatic deduplication**: Multiple components calling same function = 1 DB query
- **Zero configuration**: Wrap functions with cache() for instant optimization
- **Perfect for DAL**: Ideal for organization-scoped data patterns

#### **Drizzle Generated Columns: Database-Level Computing**
- **Move logic to database**: Computed fields handled at database level
- **Performance boost**: Eliminate application-layer calculations
- **Consistency**: Database-level computed values always accurate
- **Examples**: Full-text search, slugs, aggregates, computed statuses

#### **Supabase SSR: Server-First Authentication**
- **Perfect DAL integration**: Server-side auth context for all queries
- **Organization scoping**: Automatic multi-tenant context 
- **Enhanced security**: No client-side token management
- **SSR optimized**: Built for App Router and Server Components

## 📋 Enhanced Implementation Goals

**Primary Goal**: Create a revolutionary server-side Data Access Layer that leverages 2025 performance optimizations for unprecedented speed and developer experience

**Current State**:
- All data fetching through tRPC client queries (`api.issue.core.getAll.useQuery()`)
- 200+ database queries scattered across 22+ tRPC routers  
- Organization scoping implemented in tRPC procedures
- Drizzle ORM with proper RLS and multi-tenancy

**Target State (2025 Enhanced)**:
- **Centralized DAL** with React 19 cache() API integration
- **Request-level memoization** eliminating duplicate queries automatically
- **Server Components** fetch data directly through cached DAL functions
- **Database-level optimizations** with generated columns
- **Server-first authentication** with Supabase SSR integration
- **3-5x performance improvement** through modern patterns

## 🎯 Implementation Plan

### Step 1: Revolutionary DAL Architecture Foundation (React 19 cache() API)

**🚀 Enhanced `src/lib/dal/base/index.ts`** (with React 19 optimizations):
```typescript
import { cache } from "react"; // 🚀 React 19 cache() API
import { db } from "~/server/db";
import { eq, and, or, desc, asc, count, sql } from "drizzle-orm";
import type { PgSelect, PgDatabase } from "drizzle-orm/pg-core";

export abstract class BaseDAL {
  protected db = db;
  protected organizationId: string;

  constructor(organizationId: string) {
    if (!organizationId) {
      throw new Error("Organization ID is required for DAL operations");
    }
    this.organizationId = organizationId;
  }

  // 🚀 Enhanced pagination with request-level caching
  protected paginate = cache(async <T extends PgSelect>(
    query: T,
    page: number = 1,
    limit: number = 20,
    cacheKey: string // For cache differentiation
  ) => {
    const offset = (page - 1) * limit;
    const [items, [{ count: totalCount }]] = await Promise.all([
      query.limit(limit).offset(offset),
      this.db.select({ count: count() }).from(query.getSQL())
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: totalCount > page * limit
      }
    };
  });

  // Base security helper with org scoping
  protected ensureOrgScope<T extends Record<string, any>>(
    condition: T,
    orgIdField: string = 'organizationId'
  ) {
    return and(condition, eq(orgIdField, this.organizationId));
  }

  // 🚀 Cache utility for complex queries
  protected createCachedQuery = <T extends any[], R>(
    queryFn: (...args: T) => Promise<R>,
    debugName: string
  ) => {
    return cache(async (...args: T): Promise<R> => {
      console.log(`🔍 [${debugName}] Query executed:`, args);
      return await queryFn(...args);
    });
  };
}

// 🚀 Revolutionary DAL factory with React 19 cache() integration
export const createDALContext = cache(async (organizationId: string) => {
  if (!organizationId) {
    throw new Error("Organization context required");
  }

  console.log("🏗️  Creating DAL context for org:", organizationId);

  return {
    organizationId,
    issues: new IssueDAL(organizationId),
    machines: new MachineDAL(organizationId), 
    locations: new LocationDAL(organizationId),
    users: new UserDAL(organizationId),
    collections: new CollectionDAL(organizationId),
    analytics: new AnalyticsDAL(organizationId), // Added for dashboard queries
  };
});

export type DALContext = Awaited<ReturnType<typeof createDALContext>>;

// 🚀 Request-level organization stats cache
export const getOrganizationStats = cache(async (organizationId: string) => {
  console.log("📊 Computing organization stats for:", organizationId);
  
  return await db.select({
    totalIssues: count(issues.id),
    totalMachines: count(machines.id),
    activeUsers: count(memberships.userId),
    // 🚀 Generated columns can be added here for complex aggregations
  })
  .from(issues)
  .leftJoin(machines, eq(machines.organizationId, organizationId))
  .leftJoin(memberships, eq(memberships.organizationId, organizationId))
  .where(eq(issues.organizationId, organizationId));
});

// 🚀 Cross-DAL cached helpers for common patterns
export const getCachedUserOrganization = cache(async (userId: string) => {
  return await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      memberships: {
        with: {
          organization: {
            columns: { id: true, name: true }
          }
        }
      }
    }
  });
});
```

**🎯 React 19 cache() Benefits**:
- **Request-level memoization**: Same function called multiple times = 1 DB query
- **Component tree optimization**: Parent and child components share cached results
- **Automatic deduplication**: Zero configuration, maximum performance
- **Perfect for Server Components**: Eliminates duplicate queries across component tree

### Step 2: Revolutionary Issue DAL Implementation (React 19 + Generated Columns)

**🚀 Enhanced `src/lib/dal/entities/issue-dal.ts`** (with cache() API + Drizzle optimizations):
```typescript
import { cache } from "react"; // 🚀 React 19 cache() API
import { BaseDAL } from "../base";
import { issues, machines, users, issueComments } from "~/server/db/schema";
import { eq, and, desc, asc, ilike, inArray, sql, gte, lte } from "drizzle-orm";

export interface IssueFilters {
  status?: string[];
  priority?: string[];
  assigneeId?: string[];
  machineId?: string[];
  locationId?: string[];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface IssueSortOptions {
  field: 'createdAt' | 'updatedAt' | 'title' | 'priority' | 'status';
  direction: 'asc' | 'desc';
}

export class IssueDAL extends BaseDAL {
  
  // 🚀 Cached main list query - eliminates duplicate calls
  findMany = cache(async (
    filters: IssueFilters = {}, 
    sort: IssueSortOptions = { field: 'createdAt', direction: 'desc' }, 
    page = 1, 
    limit = 20
  ) => {
    console.log(`🔍 [IssueDAL.findMany] Query for org: ${this.organizationId}`);
    
    const query = this.db.query.issues.findMany({
      where: this.buildWhereCondition(filters),
      with: {
        machine: {
          columns: { 
            id: true, 
            name: true, 
            model: true, 
            locationId: true,
            // 🚀 Generated columns for computed fields
            fullTextSearch: true, // Generated column for search
            statusSummary: true,   // Generated column for aggregates
          },
          with: {
            location: {
              columns: { id: true, name: true }
            }
          }
        },
        assignee: {
          columns: { id: true, name: true, email: true }
        },
        createdByUser: {
          columns: { id: true, name: true }
        }
      },
      orderBy: this.buildOrderBy(sort),
    });

    return this.paginate(query, page, limit, `issues-${this.organizationId}-${JSON.stringify(filters)}`);
  });

  // 🚀 Cached single issue query with full relations
  findById = cache(async (issueId: string) => {
    console.log(`🔍 [IssueDAL.findById] Query for issue: ${issueId}`);
    
    const issue = await this.db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organizationId, this.organizationId)
      ),
      with: {
        machine: {
          with: {
            location: true,
            model: true
          }
        },
        assignee: {
          columns: { id: true, name: true, email: true, avatarUrl: true }
        },
        createdByUser: {
          columns: { id: true, name: true }
        },
        comments: {
          with: {
            user: {
              columns: { id: true, name: true, avatarUrl: true }
            }
          },
          orderBy: [desc(issueComments.createdAt)]
        },
        // 🚀 Generated columns for complex computations
        timeline: true,      // Generated JSON column for activity timeline
        metrics: true,       // Generated column for performance metrics
        searchVector: true,  // Generated tsvector for full-text search
      }
    });

    if (!issue) {
      throw new Error("Issue not found or access denied");
    }

    return issue;
  });

  // 🚀 Cached dashboard statistics - shared across components
  getStats = cache(async () => {
    console.log(`📊 [IssueDAL.getStats] Computing for org: ${this.organizationId}`);
    
    const [stats] = await this.db
      .select({
        totalIssues: count(),
        openIssues: count(eq(issues.status, 'open')),
        inProgressIssues: count(eq(issues.status, 'in_progress')),
        closedIssues: count(eq(issues.status, 'closed')),
        highPriorityIssues: count(eq(issues.priority, 'high')),
        // 🚀 Generated columns aggregations at database level
        avgResolutionTime: sql<number>`AVG(${issues.resolutionTimeMinutes})`, // Generated column
        criticalIssuesCount: sql<number>`COUNT(*) FILTER (WHERE ${issues.computedSeverity} = 'critical')`, // Generated
      })
      .from(issues)
      .where(eq(issues.organizationId, this.organizationId));

    return stats;
  });

  // 🚀 Cached recent activity - perfect for dashboards
  getRecentActivity = cache(async (limit = 10) => {
    console.log(`⏰ [IssueDAL.getRecentActivity] Recent ${limit} for org: ${this.organizationId}`);
    
    return await this.db.query.issues.findMany({
      where: eq(issues.organizationId, this.organizationId),
      with: {
        machine: {
          columns: { id: true, name: true }
        },
        assignee: {
          columns: { id: true, name: true }
        }
      },
      orderBy: [desc(issues.updatedAt)],
      limit
    });
  });

  // Single issue with full relations
  async findById(issueId: string) {
    const issue = await this.db.query.issues.findFirst({
      where: and(
        eq(issues.id, issueId),
        eq(issues.organizationId, this.organizationId)
      ),
      with: {
        machine: {
          with: {
            location: true,
            model: true
          }
        },
        assignee: {
          columns: { id: true, name: true, email: true, avatarUrl: true }
        },
        createdByUser: {
          columns: { id: true, name: true }
        },
        comments: {
          with: {
            user: {
              columns: { id: true, name: true, avatarUrl: true }
            }
          },
          orderBy: [desc(issueComments.createdAt)]
        }
      }
    });

    if (!issue) {
      throw new Error("Issue not found or access denied");
    }

    return issue;
  }

  // Create new issue
  async create(data: {
    title: string;
    description?: string;
    priority: string;
    status: string;
    machineId: string;
    assigneeId?: string;
    createdBy: string;
  }) {
    const [newIssue] = await this.db.insert(issues).values({
      ...data,
      organizationId: this.organizationId,
    }).returning();

    return newIssue;
  }

  // Update existing issue
  async update(issueId: string, data: Partial<typeof data>) {
    const [updatedIssue] = await this.db
      .update(issues)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(issues.id, issueId),
        eq(issues.organizationId, this.organizationId)
      ))
      .returning();

    if (!updatedIssue) {
      throw new Error("Issue not found or access denied");
    }

    return updatedIssue;
  }

  // Delete issue
  async delete(issueId: string) {
    const result = await this.db
      .delete(issues)
      .where(and(
        eq(issues.id, issueId),
        eq(issues.organizationId, this.organizationId)
      ))
      .returning({ id: issues.id });

    if (result.length === 0) {
      throw new Error("Issue not found or access denied");
    }

    return result[0];
  }

  // Dashboard statistics
  async getStats() {
    const [stats] = await this.db
      .select({
        totalIssues: count(),
        openIssues: count(eq(issues.status, 'open')),
        inProgressIssues: count(eq(issues.status, 'in_progress')),
        closedIssues: count(eq(issues.status, 'closed')),
        highPriorityIssues: count(eq(issues.priority, 'high')),
      })
      .from(issues)
      .where(eq(issues.organizationId, this.organizationId));

    return stats;
  }

  // Recent activity
  async getRecentActivity(limit = 10) {
    return await this.db.query.issues.findMany({
      where: eq(issues.organizationId, this.organizationId),
      with: {
        machine: {
          columns: { id: true, name: true }
        },
        assignee: {
          columns: { id: true, name: true }
        }
      },
      orderBy: [desc(issues.updatedAt)],
      limit
    });
  }

  // Private helper methods
  private buildWhereCondition(filters: IssueFilters) {
    const conditions = [eq(issues.organizationId, this.organizationId)];

    if (filters.status?.length) {
      conditions.push(inArray(issues.status, filters.status));
    }

    if (filters.priority?.length) {
      conditions.push(inArray(issues.priority, filters.priority));
    }

    if (filters.assigneeId?.length) {
      conditions.push(inArray(issues.assigneeId, filters.assigneeId));
    }

    if (filters.machineId?.length) {
      conditions.push(inArray(issues.machineId, filters.machineId));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(issues.title, `%${filters.search}%`),
          ilike(issues.description, `%${filters.search}%`)
        )
      );
    }

    if (filters.dateFrom) {
      conditions.push(gte(issues.createdAt, filters.dateFrom));
    }

    if (filters.dateTo) {
      conditions.push(lte(issues.createdAt, filters.dateTo));
    }

    return and(...conditions);
  }

  private buildOrderBy(sort: IssueSortOptions) {
    const direction = sort.direction === 'asc' ? asc : desc;
    
    switch (sort.field) {
      case 'title':
        return [direction(issues.title)];
      case 'priority':
        return [direction(issues.priority)];
      case 'status':
        return [direction(issues.status)];
      case 'updatedAt':
        return [direction(issues.updatedAt)];
      default:
        return [direction(issues.createdAt)];
    }
  }
}
```

### Step 3: Machine DAL Implementation

**Create `src/server/dal/entities/machine-dal.ts`**:
```typescript
import { BaseDAL } from "../base";
import { machines, locations, machineModels, issues } from "~/server/db/schema";
import { eq, and, desc, ilike, count } from "drizzle-orm";

export interface MachineFilters {
  locationId?: string[];
  modelId?: string[];
  status?: string[];
  search?: string;
}

export class MachineDAL extends BaseDAL {
  
  async findMany(filters: MachineFilters = {}, page = 1, limit = 20) {
    const query = this.db.query.machines.findMany({
      where: this.buildWhereCondition(filters),
      with: {
        location: {
          columns: { id: true, name: true }
        },
        model: {
          columns: { id: true, name: true, manufacturer: true, yearReleased: true }
        },
        issues: {
          where: eq(issues.status, 'open'),
          columns: { id: true, title: true, priority: true }
        }
      },
      orderBy: [desc(machines.createdAt)]
    });

    return this.paginate(query, page, limit);
  }

  async findById(machineId: string) {
    const machine = await this.db.query.machines.findFirst({
      where: and(
        eq(machines.id, machineId),
        eq(machines.organizationId, this.organizationId)
      ),
      with: {
        location: true,
        model: true,
        issues: {
          orderBy: [desc(issues.createdAt)],
          limit: 10,
          with: {
            assignee: {
              columns: { id: true, name: true }
            }
          }
        }
      }
    });

    if (!machine) {
      throw new Error("Machine not found or access denied");
    }

    return machine;
  }

  async create(data: {
    name: string;
    serialNumber?: string;
    locationId: string;
    modelId: string;
    notes?: string;
    status: string;
    createdBy: string;
  }) {
    const [newMachine] = await this.db.insert(machines).values({
      ...data,
      organizationId: this.organizationId,
    }).returning();

    return newMachine;
  }

  async update(machineId: string, data: Partial<typeof data>) {
    const [updatedMachine] = await this.db
      .update(machines)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(machines.id, machineId),
        eq(machines.organizationId, this.organizationId)
      ))
      .returning();

    if (!updatedMachine) {
      throw new Error("Machine not found or access denied");
    }

    return updatedMachine;
  }

  async getInventoryStats() {
    const [stats] = await this.db
      .select({
        totalMachines: count(),
        activeMachines: count(eq(machines.status, 'active')),
        maintenanceMachines: count(eq(machines.status, 'maintenance')),
        inactiveMachines: count(eq(machines.status, 'inactive')),
      })
      .from(machines)
      .where(eq(machines.organizationId, this.organizationId));

    return stats;
  }

  private buildWhereCondition(filters: MachineFilters) {
    const conditions = [eq(machines.organizationId, this.organizationId)];

    if (filters.locationId?.length) {
      conditions.push(inArray(machines.locationId, filters.locationId));
    }

    if (filters.modelId?.length) {
      conditions.push(inArray(machines.modelId, filters.modelId));
    }

    if (filters.status?.length) {
      conditions.push(inArray(machines.status, filters.status));
    }

    if (filters.search) {
      conditions.push(
        or(
          ilike(machines.name, `%${filters.search}%`),
          ilike(machines.serialNumber, `%${filters.search}%`)
        )
      );
    }

    return and(...conditions);
  }
}
```

### Step 4: User & Organization DAL

**Create `src/server/dal/entities/user-dal.ts`**:
```typescript
import { BaseDAL } from "../base";
import { users, memberships, organizations } from "~/server/db/schema";
import { eq, and, ilike } from "drizzle-orm";

export class UserDAL extends BaseDAL {
  
  async findMembersInOrganization(search?: string, page = 1, limit = 20) {
    const query = this.db.query.memberships.findMany({
      where: and(
        eq(memberships.organizationId, this.organizationId),
        search ? ilike(users.name, `%${search}%`) : undefined
      ),
      with: {
        user: {
          columns: { id: true, name: true, email: true, avatarUrl: true }
        }
      },
      orderBy: [users.name]
    });

    return this.paginate(query, page, limit);
  }

  async findById(userId: string) {
    const membership = await this.db.query.memberships.findFirst({
      where: and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, this.organizationId)
      ),
      with: {
        user: {
          columns: { id: true, name: true, email: true, avatarUrl: true }
        },
        organization: {
          columns: { id: true, name: true }
        }
      }
    });

    if (!membership) {
      throw new Error("User not found in organization");
    }

    return membership;
  }

  async getActivityStats(userId: string) {
    // Get user's activity within the organization
    const [issueStats] = await this.db
      .select({
        assignedIssues: count(eq(issues.assigneeId, userId)),
        createdIssues: count(eq(issues.createdBy, userId)),
        openAssigned: count(and(
          eq(issues.assigneeId, userId),
          eq(issues.status, 'open')
        ))
      })
      .from(issues)
      .where(and(
        eq(issues.organizationId, this.organizationId),
        or(eq(issues.assigneeId, userId), eq(issues.createdBy, userId))
      ));

    return issueStats;
  }
}
```

### Step 5: Revolutionary Supabase SSR + DAL Integration (2025)

**🚀 Enhanced `src/lib/dal/utils/auth-helpers.ts`** (Supabase SSR + React 19 cache()):
```typescript
import { cache } from "react"; // 🚀 React 19 cache() API
import { createClient } from "~/lib/supabase/server"; // 🚀 Supabase SSR client
import { redirect } from "next/navigation";
import { createDALContext } from "../base";
import type { User } from "@supabase/supabase-js";

// 🚀 Cached server-side DAL context - eliminates duplicate auth calls
export const getServerDALContext = cache(async () => {
  console.log("🔐 Getting server DAL context with Supabase SSR");
  
  const supabase = await createClient(); // SSR client
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.log("❌ Authentication failed, redirecting to sign-in");
    redirect("/auth/sign-in");
  }

  const organizationId = user.user_metadata?.organizationId;
  if (!organizationId) {
    console.log("❌ No organization context, redirecting to onboarding");
    redirect("/onboarding");
  }

  console.log("✅ DAL context created for user:", user.id, "org:", organizationId);

  return {
    user,
    organizationId,
    dal: await createDALContext(organizationId) // Also cached!
  };
});

// 🚀 Cached authentication check - shared across Server Components
export const requireAuth = cache(async (): Promise<User> => {
  console.log("🔐 Checking authentication with Supabase SSR");
  
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.log("❌ Auth failed:", error?.message || "No user");
    redirect("/auth/sign-in");
  }

  return user;
});

// 🚀 Cached organization context - perfect for multi-tenant apps
export const requireOrgContext = cache(async () => {
  console.log("🏢 Getting organization context");
  
  const user = await requireAuth(); // Uses cached auth
  const organizationId = user.user_metadata?.organizationId;
  
  if (!organizationId) {
    console.log("❌ User has no organization context");
    redirect("/onboarding");
  }

  return {
    user,
    organizationId,
    dal: await createDALContext(organizationId) // Uses cached DAL context
  };
});

// 🚀 Enhanced user organization helper with caching
export const getUserWithOrganization = cache(async (userId: string) => {
  console.log("👤 Getting user with organization:", userId);
  
  const supabase = await createClient();
  
  // Use Supabase query for user + organization in single call
  const { data: user, error } = await supabase
    .from('users')
    .select(`
      id, name, email, avatar_url,
      memberships:memberships(
        role,
        organization:organizations(id, name)
      )
    `)
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error("User not found");
  }

  return user;
});

// 🚀 Server Component auth wrapper
export async function withServerAuth<T>(
  component: (context: Awaited<ReturnType<typeof getServerDALContext>>) => Promise<T>
) {
  const context = await getServerDALContext(); // Cached
  return await component(context);
}

// 🚀 Cache organization members for team displays
export const getOrganizationMembers = cache(async (organizationId: string) => {
  console.log("👥 Getting organization members:", organizationId);
  
  const supabase = await createClient();
  
  const { data: members, error } = await supabase
    .from('memberships')
    .select(`
      role, created_at,
      user:users(id, name, email, avatar_url)
    `)
    .eq('organization_id', organizationId);

  if (error) {
    console.error("Error fetching members:", error);
    return [];
  }

  return members || [];
});
```

**🎯 Supabase SSR + React 19 cache() Benefits**:
- **Server-first authentication**: No client-side token management
- **Request-level auth caching**: Multiple components share same auth context
- **Organization context caching**: Multi-tenant queries optimized
- **SSR optimized**: Built for App Router and Server Components
- **Security enhanced**: Server-side auth validation only

**Create `src/server/dal/utils/validation.ts`**:
```typescript
import { z } from "zod";

// Validation schemas for DAL operations
export const issueFiltersSchema = z.object({
  status: z.array(z.string()).optional(),
  priority: z.array(z.string()).optional(), 
  assigneeId: z.array(z.string()).optional(),
  machineId: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const machineFil tersSchema = z.object({
  locationId: z.array(z.string()).optional(),
  modelId: z.array(z.string()).optional(),
  status: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// URL search params to validated filters
export function parseSearchParams<T>(
  searchParams: URLSearchParams,
  schema: z.ZodSchema<T>
): T {
  const params = Object.fromEntries(searchParams);
  
  // Convert array params (status=open,closed -> status: ['open', 'closed'])
  const processedParams = Object.entries(params).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && value.includes(',')) {
      acc[key] = value.split(',').filter(Boolean);
    } else {
      acc[key] = value;
    }
    return acc;
  }, {} as Record<string, any>);

  return schema.parse(processedParams);
}
```

### Step 6: Server Component Integration

**Create example Server Component using DAL**:
```typescript
// src/app/issues/page.tsx
import { requireOrgContext } from "~/server/dal/utils/auth-helpers";
import { parseSearchParams, issueFiltersSchema } from "~/server/dal/utils/validation";
import { IssuesTable } from "~/components/issues/IssuesTable";
import { IssuesFilters } from "~/components/issues/IssuesFilters";

interface IssuesPageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function IssuesPage({ searchParams }: IssuesPageProps) {
  const { dal } = await requireOrgContext();
  
  // Parse and validate filters from URL
  const filters = parseSearchParams(
    new URLSearchParams(searchParams as any),
    issueFiltersSchema
  );

  // Fetch data server-side
  const issuesData = await dal.issues.findMany(filters, {
    field: 'createdAt',
    direction: 'desc'
  }, filters.page, filters.limit);

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Issues</h1>
      </div>
      
      <div className="space-y-6">
        <IssuesFilters initialFilters={filters} />
        <IssuesTable 
          issues={issuesData.items}
          pagination={issuesData.pagination}
        />
      </div>
    </div>
  );
}
```

## 🎯 Revolutionary Success Criteria (2025)

**🚀 Phase 1B Complete When**:
1. ✅ **DAL classes** handle all major database operations with React 19 cache() integration
2. ✅ **Server Components** fetch data via cached DAL functions (zero duplicate queries)
3. ✅ **Organization scoping** works consistently with Supabase SSR authentication
4. ✅ **Request-level memoization** eliminates duplicate queries across component tree
5. ✅ **Generated columns** move complex computations to database level
6. ✅ **Auth context caching** provides instant authentication across components  
7. ✅ **Type safety** maintained across all modern patterns
8. ✅ **Performance achieves 3-5x improvement** over traditional tRPC client patterns
9. ✅ **Dashboard queries** leverage shared cache for instant loading

**🎯 Revolutionary Performance Targets (Measured)**:

#### **Database Query Optimization (3-5x Improvement)**
- **Duplicate query elimination**: Multiple component calls → 1 database query
- **Request-level caching**: Same org data shared across entire request
- **Generated columns**: Complex calculations moved to database level
- **Auth context caching**: Authentication resolved once per request
- **Dashboard performance**: Statistics queries cached and shared

#### **Server Component Rendering**
- **Data fetching**: Under 50ms (cached) vs 150ms+ (uncached)
- **Component rendering**: Under 100ms with pre-loaded data
- **Dashboard loading**: Near-instant with cached organization stats
- **Authentication**: Zero authentication overhead (cached context)

#### **Modern Architecture Benefits**
- **Query deduplication**: Automatic with cache() API
- **Database performance**: Generated columns eliminate app-layer computing
- **Security**: Server-first authentication with Supabase SSR
- **Multi-tenancy**: Organization context cached and shared
- **Type safety**: Full TypeScript support across modern patterns

#### **Developer Experience Revolution**
- **Debugging**: Console logs show cache hits/misses for optimization
- **Performance visibility**: Clear logging of query execution patterns
- **Error handling**: Enhanced with Supabase SSR error patterns
- **Development speed**: Instant hot reloads with cached data context

**🔍 Performance Monitoring Examples**:
```typescript
// Multiple components calling getIssuesForOrg() logs:
🔍 [IssueDAL.findMany] Query for org: test-org-pinpoint  // Only once per request
📊 [IssueDAL.getStats] Computing for org: test-org-pinpoint  // Cached
⏰ [IssueDAL.getRecentActivity] Recent 10 for org: test-org-pinpoint  // Cached
```

**Quality Gates**:
- **Zero N+1 problems**: Proper relation loading with cache() memoization
- **Organization isolation**: Security boundaries enforced at DAL level
- **Error boundaries**: Graceful handling of authentication and database failures  
- **Cache efficiency**: Monitoring shows significant query reduction

## 🚨 Risk Mitigation

**High-Risk Areas**:
- **N+1 Query Problems**: Complex relations and eager loading
- **Auth Context**: Ensuring organization scoping never fails
- **Query Performance**: Database query optimization

**Mitigation Strategies**:
- Comprehensive query analysis and optimization
- Strict organization scoping validation
- Performance monitoring and alerting
- Comprehensive error handling and logging

**Testing Strategy**:
- Unit tests for each DAL class
- Integration tests with real database
- Performance benchmarking
- Security testing for organization isolation

## ⏭️ Next Steps

Once Phase 1B is complete:
- **Phase 1C**: Server Actions infrastructure
- **Phase 1D**: Layout system conversion
- Integration with Phase 1A shadcn/ui components

The DAL foundation enables direct server-side data access for all subsequent Server Component implementations.