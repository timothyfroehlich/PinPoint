/**
 * Universal Search Service for Phase 3C
 * Server-side search logic with PostgreSQL full-text search and cross-entity capabilities
 */

import { cache } from "react";
import { and, eq, sql, desc, count } from "drizzle-orm";
import { db } from "~/lib/dal/shared";
import {
  issues,
  machines,
  users,
  locations,
  models,
  memberships,
  priorities,
  issueStatuses,
} from "~/server/db/schema";

export type SearchEntity = "issues" | "machines" | "users" | "locations" | "all";

export interface SearchOptions {
  query: string;
  entities: SearchEntity[];
  organizationId: string;
  filters?: Record<string, any>;
  pagination?: {
    page: number;
    limit: number;
  };
  sorting?: {
    field: string;
    order: "asc" | "desc";
  };
}

export interface SearchResult {
  entity: SearchEntity;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  url: string;
  metadata: Record<string, any>;
  relevance: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  entityCounts: Record<SearchEntity, number>;
  hasMore: boolean;
  page: number;
  limit: number;
}

/**
 * Request-level cached universal search
 * Uses React 19 cache() for performance optimization
 */
export const performUniversalSearch = cache(async (options: SearchOptions): Promise<SearchResponse> => {
  const { query, entities, organizationId, pagination = { page: 1, limit: 20 } } = options;
  const offset = (pagination.page - 1) * pagination.limit;

  if (!query.trim() || query.length < 2) {
    return {
      results: [],
      totalCount: 0,
      entityCounts: {} as Record<SearchEntity, number>,
      hasMore: false,
      page: pagination.page,
      limit: pagination.limit,
    };
  }

  // Execute searches and counts in parallel for performance
  const searchPromises: Promise<SearchResult[]>[] = [];
  const countPromises: Promise<{ entity: SearchEntity; count: number }>[] = [];

  // Determine which entities to search
  const entitiesToSearch = entities.includes("all") 
    ? ["issues", "machines", "users", "locations"] as SearchEntity[]
    : entities;

  // Issue search
  if (entitiesToSearch.includes("issues")) {
    searchPromises.push(searchIssues(query, organizationId, Math.ceil(pagination.limit / entitiesToSearch.length)));
    countPromises.push(countIssues(query, organizationId).then(count => ({ entity: "issues" as const, count })));
  }

  // Machine search
  if (entitiesToSearch.includes("machines")) {
    searchPromises.push(searchMachines(query, organizationId, Math.ceil(pagination.limit / entitiesToSearch.length)));
    countPromises.push(countMachines(query, organizationId).then(count => ({ entity: "machines" as const, count })));
  }

  // User search
  if (entitiesToSearch.includes("users")) {
    searchPromises.push(searchUsers(query, organizationId, Math.ceil(pagination.limit / entitiesToSearch.length)));
    countPromises.push(countUsers(query, organizationId).then(count => ({ entity: "users" as const, count })));
  }

  // Location search
  if (entitiesToSearch.includes("locations")) {
    searchPromises.push(searchLocations(query, organizationId, Math.ceil(pagination.limit / entitiesToSearch.length)));
    countPromises.push(countLocations(query, organizationId).then(count => ({ entity: "locations" as const, count })));
  }

  // Execute all queries in parallel
  const [searchResults, countResults] = await Promise.all([
    Promise.all(searchPromises),
    Promise.all(countPromises),
  ]);

  // Combine and sort results by relevance
  const allResults = searchResults.flat().sort((a, b) => b.relevance - a.relevance);

  // Build entity count map
  const entityCounts = countResults.reduce((acc, { entity, count }) => {
    acc[entity] = count;
    return acc;
  }, {} as Record<SearchEntity, number>);

  // Apply pagination to combined results
  const totalCount = allResults.length;
  const paginatedResults = allResults.slice(offset, offset + pagination.limit);
  const hasMore = offset + pagination.limit < totalCount;

  return {
    results: paginatedResults,
    totalCount,
    entityCounts,
    hasMore,
    page: pagination.page,
    limit: pagination.limit,
  };
});

/**
 * Search issues using full-text search with organization scoping
 */
async function searchIssues(query: string, organizationId: string, limit: number): Promise<SearchResult[]> {
  const searchVector = sql`to_tsvector('english', ${issues.title} || ' ' || coalesce(${issues.description}, '') || ' ' || coalesce(${issues.consistency}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const results = await db
    .select({
      id: issues.id,
      title: issues.title,
      description: issues.description,
      consistency: issues.consistency,
      createdAt: issues.created_at,
      machineName: machines.name,
      machineId: machines.id,
      statusName: issueStatuses.name,
      statusCategory: issueStatuses.category,
      priorityName: priorities.name,
      priorityOrder: priorities.order,
      assigneeName: users.name,
      assigneeId: users.id,
      relevance: sql<number>`ts_rank(${searchVector}, ${searchQuery})`.as('relevance'),
    })
    .from(issues)
    .leftJoin(machines, eq(issues.machine_id, machines.id))
    .leftJoin(issueStatuses, eq(issues.status_id, issueStatuses.id))
    .leftJoin(priorities, eq(issues.priority_id, priorities.id))
    .leftJoin(users, eq(issues.assigned_to_id, users.id))
    .where(
      and(
        eq(issues.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    )
    .orderBy(sql`ts_rank(${searchVector}, ${searchQuery}) DESC`, desc(issues.created_at))
    .limit(limit);

  return results.map(issue => ({
    entity: "issues" as const,
    id: issue.id,
    title: issue.title,
    subtitle: issue.machineName ? `${issue.machineName} • ${issue.statusName}` : issue.statusName || "No status",
    description: issue.description?.slice(0, 150) + (issue.description && issue.description.length > 150 ? "..." : ""),
    url: `/issues/${issue.id}`,
    metadata: {
      status: issue.statusName,
      statusCategory: issue.statusCategory,
      priority: issue.priorityName,
      machine: issue.machineName,
      machineId: issue.machineId,
      assignee: issue.assigneeName,
      assigneeId: issue.assigneeId,
      createdAt: issue.createdAt,
      consistency: issue.consistency,
    },
    relevance: Number(issue.relevance || 0) * 100, // Scale relevance for sorting
  }));
}

/**
 * Search machines using full-text search with organization scoping
 */
async function searchMachines(query: string, organizationId: string, limit: number): Promise<SearchResult[]> {
  const searchVector = sql`to_tsvector('english', ${machines.name} || ' ' || coalesce(${models.name}, '') || ' ' || coalesce(${models.manufacturer}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const results = await db
    .select({
      id: machines.id,
      name: machines.name,
      modelName: models.name,
      manufacturer: models.manufacturer,
      year: models.year,
      locationName: locations.name,
      locationId: locations.id,
      qrCodeId: machines.qr_code_id,
      createdAt: machines.created_at,
      issueCount: sql<number>`(
        SELECT COUNT(*) 
        FROM ${issues} 
        WHERE ${issues.machine_id} = ${machines.id} 
        AND ${issues.organization_id} = ${organizationId}
        AND ${issues.status_id} IN (
          SELECT id FROM ${issueStatuses} 
          WHERE ${issueStatuses.category} IN ('NEW', 'IN_PROGRESS')
        )
      )`.as('issue_count'),
      relevance: sql<number>`ts_rank(${searchVector}, ${searchQuery})`.as('relevance'),
    })
    .from(machines)
    .leftJoin(models, eq(machines.model_id, models.id))
    .leftJoin(locations, eq(machines.location_id, locations.id))
    .where(
      and(
        eq(machines.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    )
    .orderBy(sql`ts_rank(${searchVector}, ${searchQuery}) DESC`, desc(machines.created_at))
    .limit(limit);

  return results.map(machine => ({
    entity: "machines" as const,
    id: machine.id,
    title: machine.name,
    subtitle: `${machine.manufacturer || "Unknown"} ${machine.modelName || "Model"}${machine.year ? ` (${machine.year})` : ''}`,
    description: machine.locationName ? `Located at ${machine.locationName}` : "Location not specified",
    url: `/machines/${machine.id}`,
    metadata: {
      model: machine.modelName,
      manufacturer: machine.manufacturer,
      year: machine.year,
      location: machine.locationName,
      locationId: machine.locationId,
      qrCodeId: machine.qrCodeId,
      issueCount: machine.issueCount || 0,
      createdAt: machine.createdAt,
    },
    relevance: Number(machine.relevance || 0) * 100,
  }));
}

/**
 * Search users through organization memberships
 */
async function searchUsers(query: string, organizationId: string, limit: number): Promise<SearchResult[]> {
  const searchVector = sql`to_tsvector('english', coalesce(${users.name}, '') || ' ' || coalesce(${users.email}, '') || ' ' || coalesce(${users.bio}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const results = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      bio: users.bio,
      profilePicture: users.profile_picture,
      createdAt: users.created_at,
      relevance: sql<number>`ts_rank(${searchVector}, ${searchQuery})`.as('relevance'),
    })
    .from(users)
    .innerJoin(memberships, eq(users.id, memberships.user_id))
    .where(
      and(
        eq(memberships.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    )
    .orderBy(sql`ts_rank(${searchVector}, ${searchQuery}) DESC`, desc(users.created_at))
    .limit(limit);

  return results.map(user => ({
    entity: "users" as const,
    id: user.id,
    title: user.name || user.email || "Unknown User",
    subtitle: user.email ?? "",
    description: user.bio?.slice(0, 150) + (user.bio && user.bio.length > 150 ? "..." : ""),
    url: `/users/${user.id}`,
    metadata: {
      email: user.email,
      bio: user.bio,
      profilePicture: user.profilePicture,
      createdAt: user.createdAt,
    },
    relevance: Number(user.relevance || 0) * 100,
  }));
}

/**
 * Search locations using full-text search with organization scoping
 */
async function searchLocations(query: string, organizationId: string, limit: number): Promise<SearchResult[]> {
  const searchVector = sql`to_tsvector('english', ${locations.name} || ' ' || coalesce(${locations.description}, '') || ' ' || coalesce(${locations.city}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const results = await db
    .select({
      id: locations.id,
      name: locations.name,
      description: locations.description,
      city: locations.city,
      state: locations.state,
      street: locations.street,
      createdAt: locations.created_at,
      machineCount: sql<number>`(
        SELECT COUNT(*) 
        FROM ${machines} 
        WHERE ${machines.location_id} = ${locations.id} 
        AND ${machines.organization_id} = ${organizationId}
      )`.as('machine_count'),
      relevance: sql<number>`ts_rank(${searchVector}, ${searchQuery})`.as('relevance'),
    })
    .from(locations)
    .where(
      and(
        eq(locations.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    )
    .orderBy(sql`ts_rank(${searchVector}, ${searchQuery}) DESC`, desc(locations.created_at))
    .limit(limit);

  return results.map(location => ({
    entity: "locations" as const,
    id: location.id,
    title: location.name,
    subtitle: `${location.city || ""}${location.city && location.state ? ", " : ""}${location.state || ""}`,
    description: location.description?.slice(0, 150) + (location.description && location.description.length > 150 ? "..." : ""),
    url: `/locations/${location.id}`,
    metadata: {
      city: location.city,
      state: location.state,
      street: location.street,
      machineCount: location.machineCount || 0,
      createdAt: location.createdAt,
    },
    relevance: Number(location.relevance || 0) * 100,
  }));
}

/**
 * Count functions for each entity type
 */
async function countIssues(query: string, organizationId: string): Promise<number> {
  const searchVector = sql`to_tsvector('english', ${issues.title} || ' ' || coalesce(${issues.description}, '') || ' ' || coalesce(${issues.consistency}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const result = await db
    .select({ count: count() })
    .from(issues)
    .where(
      and(
        eq(issues.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    );

  return result[0]?.count || 0;
}

async function countMachines(query: string, organizationId: string): Promise<number> {
  const searchVector = sql`to_tsvector('english', ${machines.name} || ' ' || coalesce(${models.name}, '') || ' ' || coalesce(${models.manufacturer}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const result = await db
    .select({ count: count() })
    .from(machines)
    .leftJoin(models, eq(machines.model_id, models.id))
    .where(
      and(
        eq(machines.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    );

  return result[0]?.count || 0;
}

async function countUsers(query: string, organizationId: string): Promise<number> {
  const searchVector = sql`to_tsvector('english', coalesce(${users.name}, '') || ' ' || coalesce(${users.email}, '') || ' ' || coalesce(${users.bio}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const result = await db
    .select({ count: count() })
    .from(users)
    .innerJoin(memberships, eq(users.id, memberships.user_id))
    .where(
      and(
        eq(memberships.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    );

  return result[0]?.count || 0;
}

async function countLocations(query: string, organizationId: string): Promise<number> {
  const searchVector = sql`to_tsvector('english', ${locations.name} || ' ' || coalesce(${locations.description}, '') || ' ' || coalesce(${locations.city}, ''))`;
  const searchQuery = sql`to_tsquery('english', ${query.split(' ').map(term => `${term}:*`).join(' & ')})`;
  
  const result = await db
    .select({ count: count() })
    .from(locations)
    .where(
      and(
        eq(locations.organization_id, organizationId),
        sql`${searchVector} @@ ${searchQuery}`,
      ),
    );

  return result[0]?.count || 0;
}

/**
 * Get search suggestions for autocomplete
 * Returns commonly searched terms and recent results
 */
export const getSearchSuggestions = cache(async (query: string, organizationId: string, limit = 5): Promise<SearchResult[]> => {
  if (!query.trim() || query.length < 2) {
    return [];
  }

  // Get top suggestions from each entity type (limited to 2 per entity for quick suggestions)
  const suggestionPromises = [
    searchIssues(query, organizationId, 2),
    searchMachines(query, organizationId, 2),
    searchUsers(query, organizationId, 1),
    searchLocations(query, organizationId, 1),
  ];

  const suggestions = await Promise.all(suggestionPromises);
  const allSuggestions = suggestions.flat().sort((a, b) => b.relevance - a.relevance);

  return allSuggestions.slice(0, limit);
});