# Task 3: Fix Logout Flow Redirect

## Overview
Currently, when users log out, they remain on the `/dashboard` page but lose their session, showing "UNAUTHORIZED" instead of being redirected to a useful page. This task fixes the logout flow to redirect users to the homepage where they can see public content.

## Priority: High
This is a critical UX issue that makes the logout experience broken and confusing.

## Current Problem

### Current Logout Behavior
1. User clicks logout button in `PrimaryAppBar`
2. `handleLogout()` calls `signOut()` from NextAuth
3. User stays on current page (`/dashboard`)
4. Page tries to load authenticated content without session
5. User sees "UNAUTHORIZED" error or loading state
6. User is confused and has poor experience

### Expected Logout Behavior  
1. User clicks logout button
2. `handleLogout()` calls `signOut()` and redirects to homepage
3. User lands on `/` and sees public dashboard content
4. User can continue browsing or log in as different user
5. Clear, intuitive experience

## Files to Modify

### Primary File: `src/app/dashboard/_components/PrimaryAppBar.tsx`

**Current State**: `handleLogout()` only calls `signOut()`  
**Target State**: `handleLogout()` calls `signOut()` and redirects to homepage

## Implementation Steps

### Step 1: Import Next.js Router

**File**: `src/app/dashboard/_components/PrimaryAppBar.tsx`

Add the router import at the top of the file:

```typescript
import { useRouter } from "next/navigation";
```

### Step 2: Initialize Router in Component

Add router initialization inside the `PrimaryAppBar` component:

```typescript
export default function PrimaryAppBar(): React.JSX.Element {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  // ... rest of existing code
```

### Step 3: Update handleLogout Function

Replace the current `handleLogout` function with this enhanced version:

```typescript
const handleLogout = async (): Promise<void> => {
  try {
    // Close the menu first for immediate UI feedback
    handleClose();
    
    // Sign out the user
    await signOut({ redirect: false }); // Don't let NextAuth handle redirect
    
    // Redirect to homepage manually for better control
    router.push('/');
    
  } catch (error) {
    console.error('Logout failed:', error);
    // Still redirect to homepage even if signOut fails
    router.push('/');
  }
};
```

### Step 4: Alternative Implementation (If Issues Arise)

If the above approach causes issues, use this more robust version:

```typescript
const handleLogout = (): void => {
  handleClose();
  
  // Sign out with explicit redirect to homepage
  void signOut({ 
    callbackUrl: '/' // NextAuth will handle the redirect
  });
};
```

## Complete Updated File

**File**: `src/app/dashboard/_components/PrimaryAppBar.tsx`

Here's the complete updated component:

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
  Box,
} from "@mui/material";
import { AccountCircle } from "@mui/icons-material";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function PrimaryAppBar(): React.JSX.Element {
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      // Close the menu first for immediate UI feedback
      handleClose();
      
      // Sign out the user without NextAuth redirect
      await signOut({ redirect: false });
      
      // Redirect to homepage where user can see public content
      router.push('/');
      
    } catch (error) {
      console.error('Logout failed:', error);
      // Still redirect to homepage even if signOut fails
      router.push('/');
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="fixed">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            PinPoint
          </Typography>
          <div>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
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
              <MenuItem onClick={handleLogout}>Logout</MenuItem>
            </Menu>
          </div>
        </Toolbar>
      </AppBar>
    </Box>
  );
}
```

## Testing the Implementation

### Manual Testing Steps

1. **Start development server**: `npm run dev:full`
2. **Navigate to homepage**: Go to `http://apc.localhost:3000`
3. **Log in**: Use dev quick login to authenticate
4. **Access dashboard**: Navigate to any authenticated page
5. **Test logout**: Click user menu → Logout
6. **Verify redirect**: Should land on homepage showing public content
7. **Verify state**: Should see public dashboard, not authentication errors

### Edge Cases to Test

1. **Network Issues**: Test logout when network is slow/offline
2. **Multiple Tabs**: Test logout behavior across multiple browser tabs
3. **Back Button**: Test browser back button after logout
4. **Direct URL Access**: Test typing `/dashboard` after logout

### Expected Behavior After Fix

✅ **Logout Success**: User lands on homepage with public content  
✅ **No Errors**: No "UNAUTHORIZED" or loading errors  
✅ **Clean State**: Session properly cleared  
✅ **Re-login**: User can immediately log in as same or different user  
✅ **Navigation**: All navigation works correctly from public state  

## Error Handling Considerations

### SignOut Failures
If `signOut()` fails for any reason:
- Still redirect to homepage (graceful degradation)
- Log error for debugging
- User gets redirected to working public page

### Router Failures  
If `router.push()` fails:
- Fallback to `window.location.href = '/'`
- Last resort: `window.location.reload()`

### Network Issues
If request fails due to network:
- User still gets redirected to public page
- Session may persist in some cases (acceptable)
- User can try logout again

## Alternative Approaches

### Approach 1: NextAuth Redirect (Simpler)
```typescript
const handleLogout = (): void => {
  handleClose();
  void signOut({ callbackUrl: '/' });
};
```

**Pros**: Simpler, NextAuth handles everything  
**Cons**: Less control over the flow

### Approach 2: Manual Redirect (Recommended)
```typescript  
const handleLogout = async (): Promise<void> => {
  handleClose();
  await signOut({ redirect: false });
  router.push('/');
};
```

**Pros**: Full control, better error handling, immediate UI feedback  
**Cons**: Slightly more complex

### Approach 3: Full Page Reload
```typescript
const handleLogout = (): void => {
  handleClose();
  void signOut({ callbackUrl: '/' });
  // Fallback
  setTimeout(() => {
    window.location.href = '/';
  }, 1000);
};
```

**Pros**: Most reliable, handles all edge cases  
**Cons**: Less smooth UX due to page reload

## Documentation References

- **NextAuth signOut**: NextAuth.js docs on signOut options and redirects  
- **Next.js Router**: `next/navigation` useRouter documentation
- **Current Implementation**: `src/app/dashboard/_components/PrimaryAppBar.tsx:35-41`
- **Testing Patterns**: `@docs/testing/troubleshooting.md` (Authentication testing)
- **User Journey**: `@docs/design-docs/cujs-list.md` (Authentication flows)

## Related Components

This change may affect:
- **Navigation State**: Other components that depend on auth state
- **Test Files**: Update `PrimaryAppBar.test.tsx` to test new redirect behavior
- **E2E Tests**: Update auth flow tests to expect homepage redirect

## Rollback Plan

If issues arise:
1. **Revert to simple approach**: Use `signOut({ callbackUrl: '/' })`
2. **Remove router import**: If router causes issues  
3. **Add error boundaries**: Wrap in try/catch for debugging
4. **Test in isolation**: Create minimal reproduction to debug

## Success Criteria

- [ ] Logout redirects to homepage (`/`)
- [ ] No "UNAUTHORIZED" errors after logout  
- [ ] Public content loads correctly after logout
- [ ] User can log in again immediately
- [ ] No console errors during logout process
- [ ] Works consistently across different browsers
- [ ] Works with different user types (admin, member, player)

## Next Steps

After implementing this fix:
1. Test logout flow thoroughly with different user types
2. Update existing tests to expect homepage redirect
3. Verify the unified dashboard (from Task 2) works correctly after logout
4. Move to Task 4: Update layout system for public navigation

This fix ensures users have a smooth, predictable logout experience that lands them on a useful public page instead of an error state.