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
- **Authorization (RBAC):** The roles system will use default roles for Beta, becoming fully configurable in V1.0.
  - **Database:** The Role, Permission, and Membership models in the Prisma schema will store the relationships between users, their roles, and what those roles are permitted to do.
  - **tRPC Middleware:** Authorization checks will be implemented as a reusable tRPC middleware. Before a procedure's logic is executed, this middleware will:
    1. Verify the user is authenticated.
    2. Identify the organization context (from subdomain or session).
    3. Check the user's Role within that organization.
    4. Verify that the Role has the required Permission to execute the procedure (e.g., issue:create_full, machine:delete).
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
name String @unique // e.g., "issue:create_full", "machine:delete", "role:manage"

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

## **6\. Implementation Strategy: Major Refactor**

**Decision:** Based on pre-production status and the need for rapid iteration toward beta, we will implement the complete V1.0 schema as a **major refactor** rather than incremental migration.

### **Refactor Approach Benefits**

- **Clean Architecture:** Start with the final V1.0 schema without legacy technical debt
- **Faster Development:** No dual-system complexity or migration overhead
- **Better Testing:** Single system to test and validate
- **Simplified Codebase:** No backward compatibility code to maintain
- **Rapid Iteration:** Frontend can be rebuilt from scratch with modern patterns

### **Implementation Strategy**

**Pre-Production Advantages:**

- No existing user data to preserve
- No production dependencies to maintain
- Frontend can be completely rebuilt
- Database can be recreated from scratch

**Breaking Changes Approach:**

1. **Database:** Replace entire schema with V1.0 design
2. **Models:** Rename GameTitle → Model, GameInstance → Machine
3. **Authorization:** Replace enum-based roles with full RBAC system (default roles for Beta)
4. **Frontend:** Move existing UI out of compilation, rebuild from scratch
5. **API:** Rebuild tRPC routers with new permission-based authorization

### **Implementation Timeline**

**Phase 1A: Backend Foundation (Current Sprint)**

1. Move existing frontend code out of compilation path
2. Delete Playwright tests (frontend will be rebuilt)
3. Replace schema.prisma with complete V1.0 schema
4. Update seeding architecture for new schema (explicit target-based seeding)
5. Rebuild tRPC authorization middleware for permission-based system
6. Update existing backend tests for new schema

**Phase 1B: New Frontend (Beta Sprint)**

1. Design and implement new UI components
2. Build issue management with checklists
3. Implement new machine/location management
4. Add comprehensive E2E testing

**Phase 1C: V1.0 Features**

1. Add configurable RBAC management interfaces
2. Advanced permission management
3. Custom role creation and assignment

### **Beta vs V1.0 RBAC Differences**

**Beta Implementation:**

- Fixed default roles: Admin, Technician, Member
- Predefined permissions assigned to roles
- Roles automatically created on organization creation
- No UI for role management

**V1.0 Enhancement:**

- Configurable roles and permissions
- Custom role creation
- Permission assignment UI
- Role management interfaces

### **Risk Mitigation**

**Technical Risks:**

- **Frontend Rebuild:** Acceptable - existing UI was placeholder for beta
- **Backend Breaking Changes:** Mitigated by comprehensive test suite
- **Data Loss:** Not applicable - no production data exists
- **Timeline Risk:** Reduced by eliminating migration complexity

**Implementation Safeguards:**

- Current state preserved in main branch
- Comprehensive test coverage before frontend rebuild
- Incremental validation at each step
- Simple rollback: create new branch from main if needed

This refactor approach maximizes development velocity and code quality for beta delivery while establishing a solid foundation for V1.0 and beyond.
