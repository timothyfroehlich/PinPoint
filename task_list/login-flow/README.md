# Unified Dashboard Implementation Task List

This directory contains detailed implementation tasks for creating a unified public/authenticated dashboard that fixes the current login flow issues.

## Problem Statement

Currently, PinPoint has several issues with its authentication flow:
1. **Logout Issue**: When users log out, they stay on `/dashboard` but lose their session, showing "UNAUTHORIZED" instead of redirecting to a public view
2. **Homepage Forces Login**: The current `/` page only shows a login modal and redirects authenticated users to `/dashboard` - there's no public content
3. **Missing Public Dashboard**: The design docs call for a public organization homepage showing locations and org info, but this doesn't exist

## Solution Overview

Transform the site from authentication-required to public-first with authentication enhancements:
- Single unified dashboard at `/` that shows public content to everyone
- Additional authenticated content appears when logged in (progressive enhancement)
- Proper logout flow that redirects to public homepage
- Comprehensive testing of the full authentication journey

## Task Order

Execute these tasks in order for best results:

### 1. **API Layer** (Foundation)
- `01-create-public-api-endpoints.md` - Create public tRPC procedures for locations and organization data

### 2. **Core Implementation** (Primary Changes)  
- `02-transform-homepage-unified-dashboard.md` - Rewrite homepage as unified dashboard
- `03-fix-logout-flow-redirect.md` - Fix logout to redirect to homepage
- `04-update-layout-public-navigation.md` - Update layout system for public/auth states

### 3. **Testing & Validation** (Quality Assurance)
- `05-create-comprehensive-playwright-test.md` - Create complete authentication flow test
- `06-update-existing-tests.md` - Update existing tests to work with new structure

## Key Files Being Modified

- `src/app/page.tsx` - Transform from login-only to unified dashboard
- `src/server/api/routers/location.ts` - Add public location endpoint
- `src/app/_components/AuthenticatedLayout.tsx` - Refactor to handle public navigation
- `src/app/dashboard/_components/PrimaryAppBar.tsx` - Fix logout redirect
- `e2e/*.spec.ts` - Update and create comprehensive tests

## Documentation References

- **Design Specs**: `@docs/design-docs/ui-architecture-plan.md` (Organization Homepage section)
- **User Journeys**: `@docs/design-docs/cujs-list.md` (Location Browsing, Authentication flows)
- **API Security**: `@docs/security/api-security.md` (Public endpoint patterns)
- **Testing**: `@docs/testing/index.md`, `@docs/e2e-testing-plan.md`

## Architecture Decision

We're implementing a **progressive enhancement** pattern:
- Public content loads first (no authentication required)
- Authenticated content enhances the experience (when session exists)
- Single page serves both use cases (unified dashboard)
- Graceful degradation when authentication fails

This approach aligns with the design docs and provides the best user experience for both public and authenticated users.