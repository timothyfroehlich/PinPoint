# Task 2: Transform Homepage into Unified Dashboard

## Overview
Completely rewrite `src/app/page.tsx` to serve as a unified dashboard that shows public content to everyone and additional authenticated content when logged in. This implements the progressive enhancement pattern described in the design docs.

## Priority: High
This is the core user experience change that addresses the main problem.

## Current vs Target State

### Current State (`src/app/page.tsx`)
- Shows only login modal for unauthenticated users
- Redirects authenticated users to `/dashboard`
- No public content available
- Forces authentication for any meaningful interaction

### Target State
- Shows organization information and locations to everyone
- Shows additional authenticated content (My Issues, etc.) when logged in
- Single page serves both public and authenticated users
- Login/logout functionality integrated into navigation

## Files to Create/Modify

### 1. **Transform**: `src/app/page.tsx`
Complete rewrite as unified dashboard

### 2. **Create**: `src/app/_components/PublicDashboard.tsx`
Public content that everyone can see

### 3. **Create**: `src/app/_components/AuthenticatedDashboard.tsx`
Additional content for authenticated users

### 4. **Create**: `src/app/_components/LocationGrid.tsx`
Reusable location display component

### 5. **Create**: `src/app/_components/OrganizationHeader.tsx`
Organization branding and info component

## Implementation Steps

### Step 1: Create Public Dashboard Component

**File**: `src/app/_components/PublicDashboard.tsx`

```typescript
"use client";

import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
} from "@mui/material";
import { LocationOn, SportsEsports } from "@mui/icons-material";

import { api } from "~/trpc/react";

interface LocationCardProps {
  location: {
    id: string;
    name: string;
    _count: { machines: number };
    machines: Array<{
      id: string;
      model: { name: string; manufacturer: string };
      _count: { issues: number };
    }>;
  };
}

function LocationCard({ location }: LocationCardProps) {
  const totalIssues = location.machines.reduce(
    (sum, machine) => sum + machine._count.issues,
    0
  );

  return (
    <Card 
      sx={{ 
        height: "100%", 
        display: "flex", 
        flexDirection: "column",
        cursor: "pointer",
        "&:hover": { elevation: 4 }
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <LocationOn sx={{ mr: 1, color: "primary.main" }} />
          <Typography variant="h6" component="h2">
            {location.name}
          </Typography>
        </Box>
        
        <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
          <SportsEsports sx={{ mr: 1, fontSize: "1.1rem" }} />
          <Typography variant="body2" color="text.secondary">
            {location._count.machines} machines
          </Typography>
        </Box>

        {totalIssues > 0 && (
          <Chip
            label={`${totalIssues} active issues`}
            size="small"
            color="warning"
            sx={{ mt: 1 }}
          />
        )}

        {/* Show popular machines */}
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
            Featured Machines:
          </Typography>
          {location.machines.slice(0, 3).map((machine) => (
            <Typography key={machine.id} variant="caption" sx={{ display: "block", fontSize: "0.7rem" }}>
              • {machine.model.name}
            </Typography>
          ))}
          {location.machines.length > 3 && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
              ... and {location.machines.length - 3} more
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export function PublicDashboard(): React.ReactNode {
  const { data: organization, isLoading: orgLoading } = api.organization.getCurrent.useQuery();
  const { data: locations, isLoading: locationsLoading } = api.location.getPublic.useQuery();

  if (orgLoading || locationsLoading) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!organization) {
    return (
      <Box sx={{ p: 3, textAlign: "center" }}>
        <Typography color="error">Organization not found</Typography>
      </Box>
    );
  }

  const totalMachines = locations?.reduce((sum, loc) => sum + loc._count.machines, 0) ?? 0;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      {/* Organization Header */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography variant="h3" component="h1" sx={{ mb: 2 }}>
          {organization.name}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>
          {locations?.length ?? 0} locations • {totalMachines} pinball machines
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Browse our pinball locations and report issues to help keep the games running smoothly.
        </Typography>
      </Box>

      {/* Locations Grid */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
          Our Locations
        </Typography>
        
        {locations && locations.length > 0 ? (
          <Grid container spacing={3}>
            {locations.map((location) => (
              <Grid key={location.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <LocationCard location={location} />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Card sx={{ p: 3, textAlign: "center" }}>
            <Typography color="text.secondary">
              No locations available at this time.
            </Typography>
          </Card>
        )}
      </Box>
    </Box>
  );
}
```

### Step 2: Create Authenticated Dashboard Component

**File**: `src/app/_components/AuthenticatedDashboard.tsx`

```typescript
"use client";

import {
  Box,
  Typography,
  Card,
  Chip,
  Alert,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import DetailedIssueCard from "../dashboard/_components/DetailedIssueCard";

import { api } from "~/trpc/react";

type IssueStatus = "new" | "in progress" | "acknowledged" | "resolved";
type IssuePriority = "high" | "medium" | "low";

export function AuthenticatedDashboard(): React.ReactNode {
  const { data: issues, isLoading, error } = api.issue.core.getAll.useQuery({});

  if (isLoading) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
          My Dashboard
        </Typography>
        <Typography color="text.secondary">Loading your issues...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 3 }}>
          My Dashboard
        </Typography>
        <Alert severity="error">Failed to load your issues: {error.message}</Alert>
      </Box>
    );
  }

  const openIssues =
    issues
      ?.filter((issue) => issue.status.category !== "RESOLVED")
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        machineName: issue.machine.model.name,
        status: issue.status.name.toLowerCase() as IssueStatus,
        priority: issue.priority.name.toLowerCase() as IssuePriority,
      })) ?? [];

  const resolvedIssues =
    issues
      ?.filter((issue) => issue.status.category === "RESOLVED")
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        machineName: issue.machine.model.name,
        status: issue.status.name.toLowerCase() as IssueStatus,
        priority: issue.priority.name.toLowerCase() as IssuePriority,
      })) ?? [];

  // Mock newly reported data (replace with real data later)
  const newlyReported = [{ location: "Pinballz Arcade", count: 2 }];

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: 3 }}>
      <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
        My Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's what's happening with your issues and assignments.
      </Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              My Open Issues
            </Typography>
            {openIssues.length > 0 ? (
              openIssues.map((issue) => (
                <DetailedIssueCard key={issue.id} {...issue} />
              ))
            ) : (
              <Card sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No open issues assigned to you.
                </Typography>
              </Card>
            )}
          </Box>

          <Box>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              Recently Resolved
            </Typography>
            {resolvedIssues.length > 0 ? (
              resolvedIssues.slice(0, 5).map((issue) => (
                <DetailedIssueCard key={issue.id} {...issue} />
              ))
            ) : (
              <Card sx={{ p: 3, textAlign: "center" }}>
                <Typography color="text.secondary">
                  No recently resolved issues.
                </Typography>
              </Card>
            )}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Box>
            <Typography variant="h5" fontWeight="medium" sx={{ mb: 3 }}>
              Newly Reported
            </Typography>
            <Card sx={{ p: 3 }}>
              {newlyReported.map((item, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 2,
                  }}
                >
                  <Typography variant="body1" fontWeight="medium">
                    {item.location}
                  </Typography>
                  <Chip
                    label={item.count}
                    sx={{
                      bgcolor: "primary.main",
                      color: "white",
                      fontWeight: "bold",
                      minWidth: 32,
                    }}
                  />
                </Box>
              ))}
            </Card>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
```

### Step 3: Rewrite Homepage

**File**: `src/app/page.tsx`

```typescript
"use client";

import { useSession } from "next-auth/react";
import { Box } from "@mui/material";

import { PublicDashboard } from "./_components/PublicDashboard";
import { AuthenticatedDashboard } from "./_components/AuthenticatedDashboard";
import { DevLoginCompact } from "./_components/DevLoginCompact";

export default function HomePage(): React.ReactNode {
  const { data: session, status } = useSession();

  // Always show public content
  const publicContent = <PublicDashboard />;

  // Show additional authenticated content if logged in
  const authenticatedContent = session ? <AuthenticatedDashboard /> : null;

  return (
    <Box>
      {/* Public content - visible to everyone */}
      {publicContent}

      {/* Authenticated content - only visible when logged in */}
      {authenticatedContent}

      {/* Dev login helper - only in development */}
      <DevLoginCompact />
    </Box>
  );
}
```

### Step 4: Update DevLoginCompact (Minor Enhancement)

**File**: `src/app/_components/DevLoginCompact.tsx`

Update the `onLogin` callback to refresh the page instead of using a callback:

```typescript
// In the handleLogin function, after successful login:
if (result.ok) {
  console.log("Login successful");
  // Refresh the page to show authenticated content
  window.location.reload();
}
```

## Design Patterns Used

### Progressive Enhancement
- **Base Layer**: Public content loads for everyone
- **Enhancement Layer**: Authenticated content appears when session exists
- **Graceful Degradation**: Site remains functional if authentication fails

### Component Composition
- **PublicDashboard**: Standalone component for public content
- **AuthenticatedDashboard**: Standalone component for auth content  
- **HomePage**: Orchestrates both components based on session state

### Data Fetching Strategy
- **Public Data**: Uses new `location.getPublic` and `organization.getCurrent` endpoints
- **Authenticated Data**: Uses existing `issue.core.getAll` endpoint
- **Error Boundaries**: Each component handles its own loading/error states

## User Experience Flow

1. **First Visit**: User sees organization info and locations immediately
2. **Browsing**: User can explore locations and machines without signing in
3. **Authentication**: User can log in via navigation to see personal dashboard
4. **Enhanced View**: Additional "My Dashboard" content appears below public content
5. **Logout**: User returns to public-only view

## Mobile Considerations

The layout uses Material-UI's responsive Grid system:
- **Mobile (xs)**: Single column layout
- **Tablet (sm)**: 2-column location grid  
- **Desktop (md+)**: 3-column location grid + sidebar for authenticated content

## Accessibility Features

- Semantic HTML structure with proper headings
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly content structure
- Color contrast compliance

## Documentation References

- **Design Specs**: `@docs/design-docs/ui-architecture-plan.md:36-48` (Organization Homepage)
- **User Journeys**: `@docs/design-docs/cujs-list.md:10` (Location Browsing)
- **Authentication Patterns**: `@docs/design-docs/frontend-phase-1-authentication.md`
- **Component Patterns**: `@docs/developer-guides/typescript-multi-config.md` (TypeScript patterns)

## Testing Checklist

After implementation, verify:

- [ ] Public content loads without authentication
- [ ] Organization information displays correctly
- [ ] Location grid shows all locations with machine counts
- [ ] Login functionality works from navigation
- [ ] Authenticated dashboard appears after login
- [ ] Personal issues load correctly
- [ ] Logout returns to public-only view
- [ ] Dev login works in development environment
- [ ] Mobile layout is responsive
- [ ] Loading states display appropriately
- [ ] Error states are handled gracefully

## Error Handling

Each component includes proper error handling:

1. **API Failures**: Show user-friendly error messages
2. **Loading States**: Display loading indicators during data fetching
3. **Empty States**: Show helpful messages when no data is available  
4. **Authentication Errors**: Gracefully degrade to public-only view

## Performance Considerations

- **Data Fetching**: Public and authenticated data load independently
- **Code Splitting**: Components are lazy-loaded where beneficial
- **Caching**: tRPC handles caching of API responses
- **Image Optimization**: Use Next.js Image component for organization logos

## Next Steps

After completing this task:
1. Test the unified dashboard thoroughly
2. Verify all API endpoints work as expected
3. Ensure responsive design works on all devices
4. Move to Task 3: Fix logout flow to redirect properly

This implementation creates a single page that serves both public and authenticated users, addressing the core UX issues while maintaining the existing authenticated functionality.