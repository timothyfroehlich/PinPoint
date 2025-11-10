# Organization Access Patterns & Security Architecture

_Comprehensive security model for multi-tenant arcade management with anonymous and authenticated access_

## Executive Summary

PinPoint operates as a **multi-tenant SaaS platform** where each arcade organization maintains isolated data while supporting cross-organizational anonymous interactions. Users exist independently of organizations and gain access through validated memberships. The platform must support anonymous users reporting issues across multiple arcade locations while maintaining strict data isolation between organizations.

## Core Architectural Principles

### 1. Users Are Organization-Agnostic Entities

- **Principle**: Users exist independently and are not "owned by" any organization
- **Rationale**: Supports consultants, multi-venue managers, and users who switch organizations
- **Implementation**: No "home organization" or "primary organization" concept in user identity

### 2. Organization Context Is Request-Scoped

- **Principle**: Organization context derives from the request (subdomain) not user identity
- **Rationale**: Enables automatic context switching and anonymous access
- **Implementation**: Subdomain resolution determines organizational data scope for every request

### 3. Access Level Is Contextual

- **Principle**: User's access level depends on both authentication status AND organization context
- **Rationale**: Same user may be a member of Org A but anonymous visitor to Org B
- **Implementation**: Dynamic access determination per request

## Access Pattern Matrix

### Anonymous Users (Not Authenticated)

#### Cross-Organization Issue Reporting

**Scenario**: User visits multiple arcades and reports issues at each location

- **Austin Pinball Club**: `apc.localhost:3000` → can report issues for APC machines
- **Flipout Pinball**: `flipout.localhost:3000` → can report issues for Flipout machines
- **Data Isolation**: Issues are tied to the organization being visited, not the user
- **Security Boundary**: Organization context prevents cross-organizational data access

#### Public Information Access

**Scenario**: Users browsing arcade information without accounts

- **Capability**: View public machine lists, locations, basic issue reports
- **Restriction**: Cannot access member-only data, admin functions, or private notes
- **Purpose**: Arcade discovery, public transparency, customer engagement

#### QR Code Reporting

**Scenario**: Anonymous users scan QR codes on machines to report issues

- **Flow**: QR contains `org.domain.com/machines/machine-id/report`
- **Context**: Organization and machine automatically determined from URL
- **Isolation**: Issue report tied to correct organization regardless of user's history

### Authenticated Users

#### Single-Organization Members

**Scenario**: User has membership in only one organization

- **Home Organization**: Full member access (private data, admin functions, issue management)
- **Other Organizations**: Same access level as anonymous users (public data only)
- **Cross-Reporting**: Can still report issues anonymously at other venues

#### Multi-Organization Members

**Scenario**: User has memberships in multiple organizations

- **Context Switching**: Automatic based on subdomain visited
- **Independent Access**: Member-level access at each organization with membership
- **Data Isolation**: Cannot see private data from Org A when accessing Org B

#### Authenticated Visitors

**Scenario**: Authenticated user visits organization where they lack membership

- **Access Level**: Same as anonymous users (public data only)
- **Identity Benefits**: Issues linked to user account for follow-up
- **Restriction**: No access to member-only features or private organizational data

## Data Visibility Levels

### Public Data (Available to All Users)

- **Machine Lists**: Basic machine information for arcade discovery
- **Location Information**: Addresses, hours, contact details
- **General Issue Reports**: Non-sensitive issue descriptions (filtered)
- **Public Events**: Tournaments, special events open to public

### Member Data (Organization Members Only)

- **Detailed Issue Reports**: Internal notes, repair histories, costs
- **Private Machine Data**: Purchase dates, maintenance schedules, revenue data
- **Member Management**: User roles, permissions, contact information
- **Analytics**: Usage statistics, performance metrics, financial data

### Administrative Data (Role-Based Access)

- **User Management**: Member invitations, role assignments, permissions
- **System Configuration**: Organization settings, integrations, billing
- **Audit Logs**: System access, changes, security events
- **Advanced Analytics**: Detailed reporting, data exports, API access

## Security Boundaries & Isolation

### Organization-Level Isolation

**Primary Security Boundary**: All data scoped by `organization_id`

- **Enforcement**: Row Level Security (RLS) policies at database level
- **Validation**: Every query automatically filtered by organization context
- **Redundancy**: Application-level filtering provides defense-in-depth

### Request-Level Context Validation

**Context Resolution Process**:

1. Extract subdomain from request URL
2. Resolve subdomain to organization entity
3. Validate organization exists and is active
4. Determine user's access level within that organization
5. Set database session variables for RLS enforcement

### Membership-Based Access Control

**Dynamic Access Determination**:

- **No Authentication**: Anonymous access to public data only
- **Authentication + No Membership**: Authenticated visitor (public data + user-linked reports)
- **Authentication + Membership**: Member access (all organizational data per role)

## Cross-Organization Scenarios

### Scenario 1: Anonymous User Journey

```
User visits APC → reports machine issue → issue tied to APC org
Same user visits Flipout → reports different issue → issue tied to Flipout org
Issues are completely isolated, no cross-contamination
```

### Scenario 2: Multi-Organization Employee

```
User works for venue management company
Logs in at client-a.domain.com → sees Client A data only
Navigates to client-b.domain.com → automatic context switch to Client B
No manual org switching required, seamless experience
```

### Scenario 3: Consultant Access Pattern

```
Consultant has memberships in 5 different arcade organizations
Access level automatically determined by subdomain visited
Can work on multiple client projects without authentication conflicts
```

## Current Architecture Problems

### Critical Security Vulnerabilities

#### 1. Metadata Access Inconsistency

- **Problem**: Mixed use of `user_metadata` (user-tamperable) and `app_metadata` (secure)
- **Risk**: Authentication bypass through user metadata manipulation
- **Impact**: Potential unauthorized access to organizational data

#### 2. Non-Functional RLS Policies

- **Problem**: Local RLS policies default to `USING (true)` - no actual protection
- **Risk**: Database-level isolation completely absent
- **Impact**: Single point of failure if application-level filtering fails

#### 3. "Home Organization" Anti-Pattern

- **Problem**: Users artificially tied to primary organization
- **Risk**: Breaks multi-organizational access patterns
- **Impact**: Poor user experience, architectural inflexibility

### Architectural Inconsistencies

#### 1. JWT vs Context Timing Mismatch

- **Problem**: Organization context needed at request time, but JWT issued at login time
- **Result**: Race conditions, stale organization context, multi-tab conflicts

#### 2. Subdomain vs Authentication Context Conflicts

- **Problem**: Subdomain says "Org A" but JWT claims "Org B"
- **Result**: Undefined behavior, potential security gaps, user confusion

## Proposed Security Model

### Core Design Philosophy

**Organization Context ≠ User Identity**

- User authentication establishes identity
- Request context establishes organizational scope
- Access level determined by intersection of both

### Three-Layer Security Approach

#### Layer 1: Middleware Validation

- **Purpose**: Early rejection of invalid organization access
- **Function**: Subdomain resolution, basic organization validation
- **Benefit**: Fast failure for non-existent organizations

#### Layer 2: Database RLS Enforcement

- **Purpose**: Cryptographically secure data isolation
- **Function**: Every database query validates organizational membership
- **Benefit**: Defense against application logic bugs, compliance requirement

#### Layer 3: Application Logic Filtering

- **Purpose**: Performance optimization and business logic enforcement
- **Function**: Explicit WHERE clauses in data access layer
- **Benefit**: Faster queries, clear code intent, additional validation

### Anonymous Access Integration

- **Public Data Policies**: RLS policies allow anonymous access to marked-public data
- **Anonymous Reporting**: Special insertion policies for anonymous issue creation
- **Session Tracking**: Anonymous session management for abuse prevention
- **Data Attribution**: Anonymous reports properly attributed to visiting organization

## Security Validation Framework

### Access Control Validation

1. **Organization Resolution**: Subdomain must resolve to active organization
2. **Membership Validation**: Authenticated users must have current membership for member-level access
3. **Data Scope Validation**: All data access must be scoped to request organization
4. **Role Permission Validation**: Member access further restricted by assigned role

### Data Isolation Testing

1. **Cross-Organization Leakage**: Verify no data visible across organizational boundaries
2. **Anonymous Access Limits**: Confirm anonymous users see only public data
3. **Membership Validation**: Test that membership changes immediately affect access
4. **RLS Policy Enforcement**: Verify database-level isolation independent of application logic

## Implementation Benefits

### Security Benefits

- **Defense-in-Depth**: Three independent security layers
- **Zero-Trust Architecture**: Every request validates organizational access
- **Audit Trail**: Complete logging of cross-organizational access patterns
- **Compliance Ready**: Database-level isolation for regulatory requirements

### User Experience Benefits

- **Seamless Context Switching**: No manual organization selection
- **Anonymous Access**: No barriers to issue reporting and information discovery
- **Multi-Organization Support**: Natural workflow for consultants and multi-venue users
- **Consistent Interface**: Same UI patterns regardless of access level

### Operational Benefits

- **Scalable Architecture**: Supports unlimited organizations without complexity
- **Clear Security Model**: Easy to understand and audit access patterns
- **Performance Optimization**: RLS enables efficient query planning
- **Developer Productivity**: Clear separation of concerns, predictable behavior

## Migration Considerations

### Current State Risk Assessment

- **Immediate Risk**: Medium - application-level filtering provides primary protection
- **Long-term Risk**: High - lack of database isolation creates compliance issues
- **User Impact**: Low - existing functionality continues during migration

### Migration Strategy

1. **Documentation Phase**: Complete security architecture documentation
2. **Cleanup Phase**: Remove organizational data from user identity
3. **Implementation Phase**: Request-time organization context with RLS
4. **Validation Phase**: Comprehensive security testing across all access patterns
5. **Enhancement Phase**: Anonymous access features and multi-org optimizations

This security architecture provides a **comprehensive foundation** for multi-tenant arcade management while supporting the full spectrum of access patterns from anonymous issue reporting to complex multi-organizational member workflows.
