---
status: current
last-updated: 2025-01-14
---

# PinPoint Terminology Reference

This document provides a comprehensive glossary of terms used throughout the PinPoint codebase and documentation. It includes both current terminology and historical terms that may appear in older documentation.

## Model Renames (Historical → Current)

During the backend refactor, several core models were renamed for clarity and consistency:

| Old Term         | Current Term | Description                                      |
| ---------------- | ------------ | ------------------------------------------------ |
| **GameTitle**    | **Model**    | Generic machine model (e.g., "Godzilla Premium") |
| **GameInstance** | **Machine**  | Specific physical machine at a location          |

## Core Concepts

### Organization & Multi-Tenancy

- **Organization**: Top-level tenant representing a collective or arcade chain (e.g., "Austin Pinball Collective")
- **Subdomain**: Unique identifier for an organization's instance (e.g., `apc.pinpoint.app`)
- **Multi-Tenancy**: Architecture supporting multiple isolated organizations in a single deployment
- **Row-Level Security**: Database-level isolation ensuring organizations cannot access each other's data
- **organizationId**: Foreign key present on all tenant-specific tables for data isolation

### Users & Access

- **User**: Global account that can belong to multiple organizations
- **Member**: User with a specific role within an organization
- **Membership**: The relationship between a User and an Organization, including their Role
- **Role**: Set of permissions within an organization (Admin, Technician, Member)
- **Permission**: Granular access control (e.g., `issue:create`, `machine:delete`)

### Physical Assets

- **Location**: Physical venue belonging to an Organization (e.g., "Main Arcade", "Workshop")
- **Model**: Generic pinball machine type from commercial sources (e.g., "Medieval Madness", "Godzilla Premium")
- **Machine**: Specific physical instance of a Model at a Location
- **Owner**: User who owns a specific Machine (for notification purposes)

### Issue Management

- **Issue**: Problem report or maintenance task for a specific Machine
- **Status**: Current state of an Issue (uses StatusCategory: NEW, IN_PROGRESS, RESOLVED)
- **Priority**: Urgency level of an Issue (Low, Medium, High)
- **Consistency**: How often an issue occurs ("Always", "Frequently", "Occasionally", "Rarely")
- **Comment**: Discussion thread entry on an Issue
- **Attachment**: Image file associated with an Issue
- **Upvote**: User endorsement of an Issue (formerly "Me Too")

### Data Sources

- **OPDB**: Open Pinball Database - external API providing authoritative pinball machine data
- **PinballMap**: External service for public pinball location data
- **Custom Model**: Machine type created within PinPoint when not available from commercial sources

### Technical Terms

- **tRPC**: Type-safe API layer used for client-server communication
- **Prisma**: ORM (Object-Relational Mapping) tool for database access
- **NextAuth.js**: Authentication library (also known as Auth.js v5)
- **Procedure**: tRPC endpoint that handles a specific operation
- **Middleware**: Code that runs before request handlers (used for auth, multi-tenancy)

### Development Terms

- **Worktree**: Git feature allowing multiple working directories from one repository
- **Epic Branch**: Long-running feature branch for major development efforts
- **Pre-commit Hook**: Automated checks that run before allowing a commit
- **ESM**: ECMAScript Modules - modern JavaScript module system
- **Fixture**: Static test data used for consistent testing scenarios

## API Procedure Types

- **publicProcedure**: No authentication required (rare)
- **protectedProcedure**: Requires authenticated user
- **organizationProcedure**: Requires organization membership with specific permissions

## Status Categories

All issue statuses map to one of three categories:

1. **NEW**: Just reported, not yet triaged
2. **IN_PROGRESS**: Being actively worked on
3. **RESOLVED**: Completed or closed

## User Roles (Beta)

During Beta, three fixed roles are available:

1. **Admin**: Full access to all features and settings
2. **Technician**: Can manage issues and machines
3. **Member**: Basic access, can report issues

## Notification Types

- **ISSUE_CREATED**: New issue on owned machine
- **ISSUE_ASSIGNED**: Issue assigned to user
- **ISSUE_STATUS_CHANGED**: Issue status updated
- **COMMENT_MENTION**: User mentioned in comment

## File Storage

- **Local Storage**: Development-only file storage in `.uploads/`
- **Vercel Blob**: Production file storage service
- **Client-side compression**: Image optimization before upload

## Collections (Future)

- **Collection**: Grouping of machines for organization/filtering
- **CollectionType**: Category of collection (e.g., "Physical Area", "Manufacturer")
- **Smart Collection**: Auto-generated collection based on machine attributes

## Common Abbreviations

- **CUJ**: Critical User Journey
- **RBAC**: Role-Based Access Control
- **OPDB**: Open Pinball Database
- **TS**: TypeScript
- **MUI**: Material UI
- **UUID**: Universally Unique Identifier
- **FK**: Foreign Key
- **PK**: Primary Key

## Legacy Terms (No Longer Used)

These terms may appear in older documentation but are no longer current:

- **basic** (role): Replaced by more specific role names
- **Game Title/Instance**: Replaced by Model/Machine
- **Me Too Button**: Now called Upvote

## See Also

- [Current Architecture](../architecture/current-state.md)
- [Backend Implementation Plan](../planning/backend_impl_plan.md)
- [Database Schema](../../src/server/db/schema/)
