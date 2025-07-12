# **Backend Implementation Plan: V1.0**

This document outlines the proposed backend architecture and data model to support all features planned for the PinPoint Beta and Version 1.0 releases. The goal is to create a flexible, secure, and scalable foundation.

## **1\. Core Architecture Overview**

The backend will be built on the existing modern TypeScript stack:

- **Framework:** Next.js (App Router)
- **API Layer:** tRPC
- **Database ORM:** Prisma
- **Authentication:** NextAuth.js
- **Deployment:** Vercel

This stack provides end-to-end typesafety, a great developer experience, and seamless deployment.

## **2\. Authentication & Authorization (RBAC)**

This system will handle user identity and control what actions they can perform.

- **Authentication Provider:** NextAuth.js will manage the sign-in process.
  - **Providers:** We will implement support for Magic Link (Email), Google, and Facebook as planned for V1.0.
  - **Session Management:** Standard session management will be handled by NextAuth, providing user context to both server components and the tRPC API.
- **Authorization (RBAC):** The configurable roles system is a cornerstone of V1.0.
  - **Database:** The Role, Permission, and Membership models in the Prisma schema will store the relationships between users, their roles, and what those roles are permitted to do.
  - **tRPC Middleware:** Authorization checks will be implemented as a reusable tRPC middleware. Before a procedure's logic is executed, this middleware will:
    1. Verify the user is authenticated.
    2. Identify the organization context (from subdomain or session).
    3. Check the user's Role within that organization.
    4. Verify that the Role has the required Permission to execute the procedure (e.g., issue:create, machine:delete).
    5. If the check fails, a UNAUTHORIZED error is returned.

## **3\. Multi-Tenancy & Subdomain Strategy**

The platform must securely isolate data between organizations.

- **Subdomain Routing:** A custom Next.js Middleware (middleware.ts) will be the entry point for handling multi-tenancy.
  - It will inspect the request's hostname (e.g., cidercade.pinpoint.app).
  - It will look up the organization associated with that subdomain in the database.
  - If found, it rewrites the request to include the organization's context, making it available to the rest of the application.
  - If not found, it can redirect to a main marketing page or an organization selection screen.
- **Data Isolation (Row-Level Security):** This is the most critical security component.
  - **Prisma Extension:** We will use Prisma's extension capabilities to implement global query filters.
  - This extension will automatically add a WHERE clause (e.g., WHERE "organizationId" \= '...';) to **every single database query** (find, update, delete, etc.) for tenant-aware models.
  - This ensures that it is architecturally impossible for a query to accidentally access data from another organization, preventing IDOR vulnerabilities.

## **4\. API Layer (tRPC)**

tRPC provides a typesafe and efficient way to build our API.

- **Router Structure:** The API will be organized into logical routers based on the data model (e.g., issue.router.ts, machine.router.ts, organization.router.ts).
- **Protected Procedures:** Most procedures will be "protected," meaning they require an authenticated user session to execute. We will have two primary types:
  - protectedProcedure: For actions related to a user's own account (e.g., updating their profile).
  - organizationProcedure: A custom procedure that uses the RBAC middleware to ensure the user not only has a session but also has the correct permissions within the current organization context.
- **Input Validation:** All procedure inputs will be strictly validated using Zod, preventing invalid data from reaching the database and providing clear error messages.

## **5\. V1.0 Database Schema**

Below is the proposed schema.prisma file. It extends the existing schema to support all Beta and V1.0 features, including RBAC, multi-tenancy, collections, and checklists.

// This is your Prisma schema file,
// learn more about it in the docs: <https://pris.ly/d/prisma-schema>

generator client {
provider \= "prisma-client-js"
}

datasource db {
provider \= "postgresql"
url \= env("DATABASE_URL")
}

// \=================================
// AUTH & USER MODELS
// \=================================

model User {
id String @id @default(cuid())
name String?
email String? @unique
emailVerified DateTime?
image String? // From provider
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

// PinPoint Specific Profile
bio String? @db.Text
profilePicture String? // Path to uploaded avatar

// Relations
accounts Account\[\]
sessions Session\[\]
memberships Membership\[\]
ownedMachines Machine\[\] @relation("MachineOwner")
issuesCreated Issue\[\] @relation("CreatedBy")
issuesAssigned Issue\[\] @relation("AssignedTo")
comments Comment\[\]
upvotes Upvote\[\]
}

model Account {
id String @id @default(cuid())
userId String
type String
provider String
providerAccountId String
refresh_token String? @db.Text
access_token String? @db.Text
expires_at Int?
token_type String?
scope String?
id_token String? @db.Text
session_state String?

user User @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)

@@unique(\[provider, providerAccountId\])
}

model Session {
id String @id @default(cuid())
sessionToken String @unique
userId String
expires DateTime
user User @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)
}

model VerificationToken {
identifier String
token String @unique
expires DateTime

@@unique(\[identifier, token\])
}

// \=================================
// ORGANIZATION & TENANCY MODELS
// \=================================

model Organization {
id String @id @default(cuid())
name String
subdomain String? @unique // For V1.0 subdomain feature
logoUrl String?
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

// Relations
memberships Membership\[\]
locations Location\[\]
roles Role\[\]
machines Machine\[\]
issues Issue\[\]
priorities Priority[]
issueStatuses IssueStatus\[\]
collectionTypes CollectionType\[\]
}

model Membership {
id String @id @default(cuid())
userId String
organizationId String
roleId String

user User @relation(fields: \[userId\], references: \[id\], onDelete: Cascade)
organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
role Role @relation(fields: \[roleId\], references: \[id\])

@@unique(\[userId, organizationId\])
}

// Models for V1.0 Configurable RBAC
model Role {
id String @id @default(cuid())
name String // e.g., "Admin", "Technician", "Manager"
organizationId String
isDefault Boolean @default(false) // To identify system-default roles

organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
memberships Membership\[\]
permissions Permission\[\] @relation("RolePermissions")

@@unique(\[name, organizationId\])
}

model Permission {
id String @id @default(cuid())
name String @unique // e.g., "issue:create", "machine:delete", "role:manage"

roles Role\[\] @relation("RolePermissions")
}

// \=================================
// CORE ASSET & ISSUE MODELS
// \=================================

model Location {
id String @id @default(cuid())
name String
organizationId String

organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
machines Machine\[\]
}

// Replaces GameTitle
model Model {
id String @id @default(cuid())
name String
manufacturer String?
year Int?

// OPDB / PinballMap specific fields
opdbId String? @unique
isCustom Boolean @default(false) // Flag for custom/homebrew models

// Relations
machines Machine\[\]
}

// Replaces GameInstance
model Machine {
id String @id @default(cuid())
organizationId String
locationId String
modelId String
ownerId String?

organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
location Location @relation(fields: \[locationId\], references: \[id\])
model Model @relation(fields: \[modelId\], references: \[id\])
owner User? @relation("MachineOwner", fields: \[ownerId\], references: \[id\])
issues Issue\[\]
collections Collection\[\]
}

model Issue {
id String @id @default(cuid())
title String
description String? @db.Text
consistency String? // e.g., "Always", "Occasionally"

// For V1.0 checklists
checklist Json? // Store checklist items as JSON: \[{ text: "...", completed: false }\]

createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
resolvedAt DateTime?

// Relations
organizationId String
machineId String
statusId String
priorityId String
createdById String
assignedToId String?

organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
machine Machine @relation(fields: \[machineId\], references: \[id\])
priority Priority @relation(fields: [priorityId], references: [id])
status IssueStatus @relation(fields: \[statusId\], references: \[id\])
createdBy User @relation("CreatedBy", fields: \[createdById\], references: \[id\])
assignedTo User? @relation("AssignedTo", fields: \[assignedToId\], references: \[id\])

comments Comment\[\]
attachments Attachment\[\]
history IssueHistory\[\]
upvotes Upvote\[\]
}

model Priority {
id String @id @default(cuid())
name String // e.g., "Low", "Medium", "High"
order Int // For sorting purposes
organizationId String
isDefault Boolean @default(false)

organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
issues Issue[]

@@unique([name, organizationId])
}

model IssueStatus {
id String @id @default(cuid())
name String // e.g., "Reported", "Diagnosing", "Awaiting Parts", "Fixed"
category StatusCategory // "NEW", "IN_PROGRESS", "RESOLVED"
organizationId String
isDefault Boolean @default(false)

organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
issues Issue\[\]

@@unique(\[name, organizationId\])
}

enum StatusCategory {
NEW
IN_PROGRESS
RESOLVED
}

model Comment {
id String @id @default(cuid())
content String @db.Text
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
issueId String
authorId String

issue Issue @relation(fields: \[issueId\], references: \[id\], onDelete: Cascade)
author User @relation(fields: \[authorId\], references: \[id\])
}

model Attachment {
id String @id @default(cuid())
url String
fileName String
fileType String
createdAt DateTime @default(now())
issueId String

issue Issue @relation(fields: \[issueId\], references: \[id\], onDelete: Cascade)
}

model IssueHistory {
id String @id @default(cuid())
field String // e.g., "status", "assignee"
oldValue String?
newValue String?
changedAt DateTime @default(now())
issueId String

issue Issue @relation(fields: \[issueId\], references: \[id\], onDelete: Cascade)
}

model Upvote {
id String @id @default(cuid())
createdAt DateTime @default(now())
issueId String
userId String

issue Issue @relation(fields: \[issueId\], references: \[id\], onDelete: Cascade)
user User @relation(fields: \[userId\], references: \[id\])

@@unique(\[issueId, userId\])
}

// \=================================
// COLLECTION & NOTIFICATION MODELS
// \=================================

model Collection {
id String @id @default(cuid())
name String
typeId String
isSmart Boolean @default(false) // For 1.x Smart Collections

type CollectionType @relation(fields: \[typeId\], references: \[id\], onDelete: Cascade)
machines Machine\[\]
}

model CollectionType {
id String @id @default(cuid())
name String // e.g., "Physical Area", "Manufacturer", "Game Era"
organizationId String

organization Organization @relation(fields: \[organizationId\], references: \[id\], onDelete: Cascade)
collections Collection\[\]
}

model Notification {
id String @id @default(cuid())
message String
read Boolean @default(false)
createdAt DateTime @default(now())
// Recipient, related entity, etc.
}

## **6\. Migration Strategy: Incremental Evolution**

**Important:** After analysis of the existing codebase, implementing the above schema as a wholesale replacement would require refactoring 47+ files and rewriting core authorization logic. To minimize risk and accelerate beta delivery, we recommend a **phased migration approach** that preserves existing functionality while adding new capabilities.

### **Current State Analysis**

The existing codebase has:

- Strong multi-tenancy patterns with `organizationId` scoping
- Simple but effective RBAC via enum (`admin | member | player`)
- Comprehensive test coverage for security
- Well-established model relationships (`GameTitle/GameInstance`, `Room`, `IssueActivity`)
- Working tRPC routers and UI components

### **Phase 1: Additive Changes (Beta → V1.0)**

**Objective:** Add new V1.0 capabilities without breaking existing functionality.

**Schema Changes:**

```prisma
// ADD new RBAC models alongside existing enum
model Role {
  id             String       @id @default(cuid())
  name           String       // "Admin", "Technician", "Manager"
  organizationId String
  isDefault      Boolean      @default(false)

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  memberships    Membership[]
  permissions    Permission[] @relation("RolePermissions")

  @@unique([name, organizationId])
}

model Permission {
  id   String @id @default(cuid())
  name String @unique // "issue:create", "machine:delete", "role:manage"
  roles Role[] @relation("RolePermissions")
}

// EXTEND existing Membership to support both systems
model Membership {
  id             String       @id @default(cuid())
  role           Role         // Keep existing enum
  userId         String
  organizationId String

  // NEW: Optional advanced RBAC
  advancedRoleId String?      // Optional during transition
  advancedRole   Role?        @relation(fields: [advancedRoleId], references: [id])

  user           User         @relation(fields: [userId], references: [id])
  organization   Organization @relation(fields: [organizationId], references: [id])

  @@unique([userId, organizationId])
}

// ADD Priority model while keeping existing severity field
model Priority {
  id             String       @id @default(cuid())
  name           String       // "Low", "Medium", "High", "Critical"
  order          Int          // For sorting
  organizationId String
  isDefault      Boolean      @default(false)

  organization   Organization @relation(fields: [organizationId], references: [id])
  issues         Issue[]

  @@unique([name, organizationId])
}

// EXTEND Issue to support both priority systems
model Issue {
  // ... existing fields including severity, number, showActivity ...

  // NEW: Optional structured priority + checklist
  priorityId     String?     // Optional during transition
  priority       Priority?   @relation(fields: [priorityId], references: [id])
  consistency    String?     // "Always", "Occasionally", "Intermittent"
  checklist      Json?       // [{ text: "Check flippers", completed: false }]

  // ... rest of existing relations ...
}
```

**Implementation Benefits:**

- **Zero Breaking Changes:** All existing code continues working
- **Gradual Adoption:** Organizations can opt into advanced RBAC
- **Feature Complete:** Supports all roadmap requirements
- **Backward Compatible:** Simple roles still work for basic organizations

### **Phase 2: Model Refinement (Post-V1.0)**

**Objective:** Streamline models after advanced features are stable.

**Optional Future Changes:**

- Rename `GameTitle` → `Model`, `GameInstance` → `Machine` (requires codebase-wide refactor)
- Consolidate priority systems (remove `severity` field once `Priority` is adopted)
- Migrate all organizations to advanced RBAC (remove enum-based roles)

### **Implementation Timeline**

**Pre-Beta (Phase 1A):**

1. Add `Role`, `Permission`, `Priority` models
2. Extend `Membership` and `Issue` with optional fields
3. Create migration scripts with default data
4. Update tRPC procedures to support both auth systems

**Beta → V1.0 (Phase 1B):**

1. Build RBAC management UI
2. Add priority management interfaces
3. Implement checklist functionality
4. Create organization upgrade path

**Post-V1.0 (Phase 2):**

1. Evaluate model rename necessity based on developer feedback
2. Plan consolidation of dual systems if needed
3. Consider breaking changes only with major version releases

### **Risk Mitigation**

**Technical Risks:**

- **Schema Conflicts:** Careful field naming prevents conflicts
- **Data Migration:** Comprehensive seed data for new models
- **Performance Impact:** Minimal - new fields are optional

**Business Risks:**

- **Feature Parity:** All roadmap features achievable with hybrid approach
- **User Experience:** Seamless transition - users see gradual improvements
- **Timeline Risk:** Dramatically reduced compared to wholesale replacement

### **Migration Scripts Required**

```sql
-- Create default roles for all existing organizations
INSERT INTO "Role" (id, name, "organizationId", "isDefault")
SELECT
  gen_random_uuid(),
  unnest(ARRAY['Admin', 'Technician', 'Member']),
  id,
  true
FROM "Organization";

-- Create default priorities for all existing organizations
INSERT INTO "Priority" (id, name, "order", "organizationId", "isDefault")
SELECT
  gen_random_uuid(),
  priority_name,
  priority_order,
  org_id,
  true
FROM (
  SELECT
    id as org_id,
    unnest(ARRAY['Low', 'Medium', 'High', 'Critical']) as priority_name,
    unnest(ARRAY[1, 2, 3, 4]) as priority_order
  FROM "Organization"
) priorities;

-- Create standard permissions
INSERT INTO "Permission" (id, name) VALUES
  (gen_random_uuid(), 'issue:create'),
  (gen_random_uuid(), 'issue:edit'),
  (gen_random_uuid(), 'issue:delete'),
  (gen_random_uuid(), 'machine:edit'),
  (gen_random_uuid(), 'organization:manage'),
  (gen_random_uuid(), 'role:manage');
```

This migration strategy ensures **rapid beta delivery** while building toward the **comprehensive V1.0 vision** with minimal technical debt and maximum stability.
