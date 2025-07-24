# Task 4: Update Layout for Public Navigation

## Overview
The current `AuthenticatedLayout` component assumes all pages except the login page need authentication and navigation. With the unified dashboard approach, we need a layout system that gracefully handles both public and authenticated users, showing appropriate navigation for each state.

## Priority: Medium
This supports the unified dashboard but isn't critical for basic functionality.

## Current vs Target State

### Current State (`src/app/_components/AuthenticatedLayout.tsx`)
- Only shows navigation on authenticated pages
- Hides navigation on login page (`pathname === "/"`)
- Assumes authentication is required for navigation
- Name implies authentication is required

### Target State  
- Shows navigation on all pages (public and authenticated)
- Different navigation content based on authentication state
- Supports public browsing with login/logout options
- Name reflects its universal nature

## Files to Modify

### 1. **Rename**: `src/app/_components/AuthenticatedLayout.tsx` → `UniversalLayout.tsx`
### 2. **Update**: `src/app/layout.tsx` - Import new component name
### 3. **Enhance**: Navigation to show login/logout based on session state

## Implementation Steps

### Step 1: Create New Universal Layout

**File**: `src/app/_components/UniversalLayout.tsx`

```typescript
"use client";

import { Box, Toolbar } from "@mui/material";
import { useSession } from "next-auth/react";

import UniversalAppBar from "./UniversalAppBar";

interface UniversalLayoutProps {
  children: React.ReactNode;
}

export function UniversalLayout({
  children,
}: UniversalLayoutProps): React.JSX.Element {
  const { status } = useSession();

  return (
    <>
      <UniversalAppBar />
      <Toolbar /> {/* Spacer for fixed AppBar */}
      <Box 
        component="main" 
        sx={{ 
          flexGrow: 1, 
          bgcolor: "background.default",
          minHeight: "calc(100vh - 64px)" // Full height minus AppBar
        }}
      >
        {children}
      </Box>
    </>
  );
}
```

### Step 2: Create Universal App Bar

**File**: `src/app/_components/UniversalAppBar.tsx`

```typescript
"use client";

import { useState } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Menu,
  MenuItem,
  Button,
  Box,
  Avatar,
} from "@mui/material";
import { AccountCircle, Login } from "@mui/icons-material";
import { signOut, signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function UniversalAppBar(): React.JSX.Element {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      handleClose();
      await signOut({ redirect: false });
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      router.push('/');
    }
  };

  const handleLogin = (): void => {
    void signIn();
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="fixed">
        <Toolbar>
          {/* Logo/Brand */}
          <Typography 
            variant="h6" 
            component={Link}
            href="/"
            sx={{ 
              flexGrow: 1,
              textDecoration: 'none',
              color: 'inherit',
              '&:hover': {
                opacity: 0.8
              }
            }}
          >
            PinPoint
          </Typography>

          {/* Navigation Links */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Public navigation always available */}
            <Button 
              color="inherit" 
              component={Link} 
              href="/"
            >
              Home
            </Button>
            
            {/* Authenticated navigation */}
            {session && (
              <>
                <Button 
                  color="inherit"
                  component={Link}
                  href="/dashboard"
                >
                  Dashboard
                </Button>
                <Button 
                  color="inherit"
                  component={Link}
                  href="/issues"
                >
                  Issues
                </Button>
                <Button 
                  color="inherit"
                  component={Link}
                  href="/games"
                >
                  Games
                </Button>
              </>
            )}
          </Box>

          {/* Authentication Controls */}
          <Box sx={{ ml: 2 }}>
            {status === "loading" ? (
              <IconButton color="inherit" disabled>
                <AccountCircle />
              </IconButton>
            ) : session ? (
              // Authenticated state - show user menu
              <div>
                <IconButton
                  size="large"
                  aria-label="account of current user"
                  aria-controls="menu-appbar"
                  aria-haspopup="true"
                  onClick={handleMenu}
                  color="inherit"
                >
                  {session.user.image ? (
                    <Avatar 
                      src={session.user.image} 
                      alt={session.user.name ?? "User"}
                      sx={{ width: 24, height: 24 }}
                    />
                  ) : (
                    <AccountCircle />
                  )}
                </IconButton>
                <Menu
                  id="menu-appbar"
                  anchorEl={anchorEl}
                  anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "right",
                  }}
                  open={Boolean(anchorEl)}
                  onClose={handleClose}
                >
                  <MenuItem onClick={handleClose} component={Link} href="/profile">
                    Profile
                  </MenuItem>
                  <MenuItem onClick={handleLogout}>
                    Logout
                  </MenuItem>
                </Menu>
              </div>
            ) : (
              // Unauthenticated state - show login button
              <Button
                color="inherit"
                startIcon={<Login />}
                onClick={handleLogin}
              >
                Sign In
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
    </Box>
  );
}
```

### Step 3: Update Root Layout

**File**: `src/app/layout.tsx`

```typescript
import { UniversalLayout } from "./_components/UniversalLayout";
import Providers from "./providers";

import type { JSX } from "react";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <head>
        <title>PinPoint</title>
      </head>
      <body>
        <Providers>
          <UniversalLayout>{children}</UniversalLayout>
        </Providers>
      </body>
    </html>
  );
}
```

### Step 4: Remove Dashboard-Specific Layout

**File**: `src/app/dashboard/layout.tsx`

Since we now have universal navigation, the dashboard doesn't need its own layout. Either remove this file entirely or simplify it:

```typescript
"use client";

import { Box } from "@mui/material";
import SecondaryHeader from "./_components/SecondaryHeader";

import type { JSX } from "react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  // Simplified - just add the secondary header for dashboard-specific content
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      <SecondaryHeader />
      <Box sx={{ p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}
```

### Step 5: Update Secondary Header (Optional)

**File**: `src/app/dashboard/_components/SecondaryHeader.tsx`

If keeping the secondary header, update it to work with the new navigation:

```typescript
"use client";

import { Box, Typography, Breadcrumbs, Link } from "@mui/material";
import { useSession } from "next-auth/react";

export default function SecondaryHeader(): React.JSX.Element {
  const { data: session } = useSession();

  if (!session) {
    return <></>; // Don't show secondary header for public users
  }

  return (
    <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
      <Breadcrumbs>
        <Link href="/" color="inherit">
          Home
        </Link>
        <Typography color="text.primary">Dashboard</Typography>
      </Breadcrumbs>
    </Box>
  );
}
```

## Design Patterns Used

### Universal Navigation Pattern
- **Always Present**: Navigation is available on all pages
- **Progressive Enhancement**: More options appear when authenticated
- **Contextual Content**: Navigation adapts to user's authentication state

### Session-Aware Components
- **Loading States**: Handle authentication loading gracefully
- **Conditional Rendering**: Show/hide features based on session
- **Error Boundaries**: Graceful degradation when session fails

### Responsive Design
- **Mobile First**: Navigation works on all screen sizes
- **Adaptive Layout**: Content adjusts to available space
- **Touch Friendly**: Large touch targets for mobile users

## User Experience Improvements

### For Public Users
✅ **Clear Navigation**: Home link always available  
✅ **Sign In Option**: Prominent login button  
✅ **No Confusion**: No "unauthorized" states in navigation  
✅ **Consistent Branding**: PinPoint logo always visible  

### For Authenticated Users  
✅ **Full Navigation**: Access to all authenticated features  
✅ **User Identity**: Avatar/name visible in navigation  
✅ **Quick Logout**: Easy access to logout option  
✅ **Profile Access**: Direct link to profile management  

### For All Users
✅ **Fast Performance**: No unnecessary re-renders  
✅ **Smooth Transitions**: Clean state changes during auth  
✅ **Mobile Friendly**: Works on all device sizes  
✅ **Accessible**: Proper ARIA labels and keyboard navigation  

## Testing Considerations

### Authentication Flow Testing
1. **Public State**: Test navigation as unauthenticated user
2. **Login Process**: Test sign-in button functionality  
3. **Authenticated State**: Test full navigation appears after login
4. **Logout Process**: Test logout returns to public navigation
5. **Session Persistence**: Test navigation across page reloads

### Navigation Testing
1. **All Links Work**: Test every navigation link functions
2. **Responsive Design**: Test on mobile, tablet, desktop
3. **Loading States**: Test behavior during authentication loading
4. **Error States**: Test behavior when authentication fails

### Edge Cases
1. **Session Expiry**: Test navigation when session expires
2. **Network Issues**: Test behavior with poor connectivity
3. **Multiple Tabs**: Test consistent state across browser tabs
4. **Back Button**: Test browser navigation works correctly

## Mobile Considerations

For mobile devices, consider adding:

```typescript
// In UniversalAppBar.tsx
const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

// Mobile menu toggle for smaller screens
<IconButton
  color="inherit"
  aria-label="open drawer"
  edge="start"
  onClick={() => setMobileMenuOpen(true)}
  sx={{ mr: 2, display: { sm: 'none' } }}
>
  <MenuIcon />
</IconButton>
```

## Accessibility Features

- **Keyboard Navigation**: All elements accessible via keyboard
- **Screen Reader Support**: Proper ARIA labels and roles
- **Focus Management**: Clear focus indicators
- **Color Contrast**: Meets WCAG guidelines
- **Semantic HTML**: Proper heading hierarchy and landmarks

## Documentation References

- **Layout Patterns**: `@docs/design-docs/ui-architecture-plan.md:7-21` (Global Components)
- **Navigation Design**: `@docs/design-docs/ui-architecture-plan.md:10-17` (Navigation Menu)
- **Authentication UX**: `@docs/design-docs/frontend-phase-1-authentication.md`
- **Component Architecture**: `@docs/developer-guides/typescript-multi-config.md`
- **Testing Patterns**: `@docs/testing/index.md`

## Performance Optimizations

### Code Splitting
- Lazy load authenticated-only components
- Use dynamic imports for user-specific features

### Caching Strategy
- Cache session state appropriately
- Minimize authentication API calls
- Use React Query/tRPC caching effectively

### Bundle Size
- Tree-shake unused Material-UI components
- Optimize imports to reduce bundle size

## Error Handling

### Session Errors
```typescript
const { data: session, status, error } = useSession();

if (error) {
  console.error('Session error:', error);
  // Still show public navigation
}
```

### Navigation Errors
```typescript
const handleNavigationError = (error: Error) => {
  console.error('Navigation error:', error);
  // Fallback to homepage
  router.push('/');
};
```

## Next Steps

After implementing this task:
1. Test navigation thoroughly in both public and authenticated states
2. Verify all navigation links work correctly
3. Test responsive design on different screen sizes
4. Update existing tests to work with new navigation
5. Move to Task 5: Create comprehensive Playwright tests

## Success Criteria

- [ ] Navigation appears on all pages
- [ ] Public users see appropriate navigation options
- [ ] Authenticated users see full navigation
- [ ] Login/logout functionality works from navigation
- [ ] Responsive design works on all devices
- [ ] No authentication errors in navigation
- [ ] Performance remains good
- [ ] Accessibility standards met

This universal layout approach provides a consistent, user-friendly navigation experience for both public and authenticated users while maintaining the flexibility needed for the unified dashboard.