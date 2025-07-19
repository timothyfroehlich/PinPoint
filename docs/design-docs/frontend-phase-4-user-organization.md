# Phase 4: User & Organization Features

## Overview

Phase 4 implements the administrative and user management features that complete the core PinPoint application. This phase focuses on user profiles, organization management, and administrative interfaces that enable full operational control of the system.

## Current State Analysis

### Backend Infrastructure Ready ✅

- **User Management**: Complete user profile, avatar, and preference APIs
- **Organization Management**: Organization settings, member management, and role administration
- **Location Management**: Physical location CRUD operations with multi-tenancy
- **Machine Management**: Complete machine lifecycle with OPDB integration
- **Role-based Access Control**: Granular permissions system fully implemented
- **File Upload System**: Avatar and organization logo upload capabilities

### Archived Frontend Patterns ✅

The archived frontend provides valuable patterns for:

- **Profile Management**: User profile editing with avatar upload
- **Organization Settings**: Organization name, logo, and configuration
- **Admin Interfaces**: User role management and organization administration
- **Navigation Patterns**: Role-based navigation and feature access

### Current Frontend State ❌

- **No Profile Pages**: Users cannot edit their profiles
- **No Admin Interfaces**: No organization management capabilities
- **No Machine Management**: No interface for managing machines
- **No Location Management**: No interface for managing locations
- **No Role Management**: No interface for managing user roles

## Goals

### Primary Goals

1. **User Profile Management**: Complete profile editing with avatar upload
2. **Organization Administration**: Full organization settings and member management
3. **Machine Management**: CRUD operations for machines with OPDB integration
4. **Location Management**: Interface for managing physical locations
5. **Role Management**: Administrative interface for user roles and permissions

### Secondary Goals

- Maintain consistent visual design with previous phases
- Implement role-based access control throughout
- Add comprehensive form validation and error handling
- Ensure mobile-responsive design for all interfaces
- Add bulk operations for administrative efficiency

## Technical Architecture

### Page Structure

```
src/app/
├── profile/
│   ├── page.tsx                    # User profile page
│   └── components/
│       ├── ProfileForm.tsx         # Profile editing form
│       ├── AvatarUpload.tsx        # Avatar upload component
│       ├── NotificationSettings.tsx # Notification preferences
│       └── OwnedMachines.tsx       # User's owned machines
├── admin/
│   ├── organization/
│   │   ├── page.tsx               # Organization settings
│   │   └── components/
│   │       ├── OrganizationForm.tsx
│   │       ├── LogoUpload.tsx
│   │       └── MemberList.tsx
│   ├── users/
│   │   ├── page.tsx               # User management
│   │   └── components/
│   │       ├── UserList.tsx
│   │       ├── RoleEditor.tsx
│   │       └── UserInvite.tsx
│   └── locations/
│       ├── page.tsx               # Location management
│       └── components/
│           ├── LocationList.tsx
│           ├── LocationForm.tsx
│           └── LocationMap.tsx
├── machines/
│   ├── page.tsx                   # Machine listing
│   ├── [id]/
│   │   └── page.tsx              # Machine detail
│   └── components/
│       ├── MachineList.tsx
│       ├── MachineForm.tsx
│       ├── MachineCard.tsx
│       └── OPDBSearch.tsx
└── locations/
    ├── page.tsx                   # Location listing
    ├── [id]/
    │   └── page.tsx              # Location detail
    └── components/
        ├── LocationList.tsx
        ├── LocationDetail.tsx
        └── MachinesByLocation.tsx
```

### Role-based Access Control

```typescript
// Permission matrix for Phase 4 features
interface PermissionMatrix {
  "profile:edit": ["admin", "technician", "member"];
  "organization:edit": ["admin"];
  "users:manage": ["admin"];
  "locations:manage": ["admin"];
  "machines:manage": ["admin", "technician"];
  "machines:create": ["admin"];
  "machines:edit": ["admin", "technician"];
  "machines:delete": ["admin"];
}
```

## Implementation Plan

### Step 1: User Profile Management (Days 1-2)

**Tasks:**

- [ ] Create profile page with current user information
- [ ] Implement profile editing form with validation
- [ ] Add avatar upload functionality
- [ ] Create notification settings interface
- [ ] Add owned machines display

**Files to Create:**

- `src/app/profile/page.tsx`
- `src/app/profile/components/ProfileForm.tsx`
- `src/app/profile/components/AvatarUpload.tsx`
- `src/app/profile/components/NotificationSettings.tsx`
- `src/app/profile/components/OwnedMachines.tsx`

### Step 2: Organization Administration (Days 3-4)

**Tasks:**

- [ ] Create organization settings page
- [ ] Implement organization logo upload
- [ ] Add member management interface
- [ ] Create user role assignment system
- [ ] Add organization statistics dashboard

**Files to Create:**

- `src/app/admin/organization/page.tsx`
- `src/app/admin/organization/components/OrganizationForm.tsx`
- `src/app/admin/organization/components/LogoUpload.tsx`
- `src/app/admin/organization/components/MemberList.tsx`
- `src/app/admin/organization/components/RoleAssignment.tsx`

### Step 3: Machine Management (Days 5-6)

**Tasks:**

- [ ] Create machine listing page
- [ ] Implement machine detail view
- [ ] Add OPDB search integration
- [ ] Create machine creation/editing forms
- [ ] Add machine ownership assignment

**Files to Create:**

- `src/app/machines/page.tsx`
- `src/app/machines/[id]/page.tsx`
- `src/app/machines/components/MachineList.tsx`
- `src/app/machines/components/MachineForm.tsx`
- `src/app/machines/components/OPDBSearch.tsx`
- `src/app/machines/components/MachineCard.tsx`

### Step 4: Location Management (Day 7)

**Tasks:**

- [ ] Create location listing page
- [ ] Implement location detail view
- [ ] Add location creation/editing forms
- [ ] Create machines by location view
- [ ] Add location statistics

**Files to Create:**

- `src/app/locations/page.tsx`
- `src/app/locations/[id]/page.tsx`
- `src/app/locations/components/LocationList.tsx`
- `src/app/locations/components/LocationForm.tsx`
- `src/app/locations/components/LocationDetail.tsx`
- `src/app/locations/components/MachinesByLocation.tsx`

## Detailed Implementation

### User Profile Page

```typescript
// src/app/profile/page.tsx
import { Container, Grid, Typography } from '@mui/material';
import { ProfileForm } from './components/ProfileForm';
import { AvatarUpload } from './components/AvatarUpload';
import { NotificationSettings } from './components/NotificationSettings';
import { OwnedMachines } from './components/OwnedMachines';
import { useCurrentUser } from '~/hooks/useCurrentUser';

export default function ProfilePage() {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) return <ProfileSkeleton />;
  if (!user) return <Alert severity="error">Please log in to view your profile</Alert>;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Profile Settings
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <AvatarUpload user={user} />
        </Grid>

        <Grid item xs={12} md={8}>
          <ProfileForm user={user} />
        </Grid>

        <Grid item xs={12}>
          <NotificationSettings user={user} />
        </Grid>

        <Grid item xs={12}>
          <OwnedMachines userId={user.id} />
        </Grid>
      </Grid>
    </Container>
  );
}
```

### Profile Form Component

```typescript
// src/app/profile/components/ProfileForm.tsx
'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  TextField,
  Button,
  Box,
  Typography,
  Alert
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '~/lib/api';
import { User } from '@prisma/client';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required'),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  user: User;
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user.name || '',
      email: user.email || '',
    }
  });

  const updateProfile = api.user.updateProfile.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      // Show success notification
    },
    onError: (error) => {
      console.error('Profile update failed:', error);
    }
  });

  const onSubmit = async (data: ProfileFormData) => {
    await updateProfile.mutateAsync(data);
  };

  const handleCancel = () => {
    reset();
    setIsEditing(false);
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Profile Information
        </Typography>

        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <TextField
            {...register('name')}
            label="Full Name"
            fullWidth
            margin="normal"
            disabled={!isEditing}
            error={!!errors.name}
            helperText={errors.name?.message}
          />

          <TextField
            {...register('email')}
            label="Email Address"
            type="email"
            fullWidth
            margin="normal"
            disabled={!isEditing}
            error={!!errors.email}
            helperText={errors.email?.message}
          />

          {updateProfile.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {updateProfile.error.message}
            </Alert>
          )}

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            {isEditing ? (
              <>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={updateProfile.isPending}
                  sx={{ bgcolor: '#667eea' }}
                >
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleCancel}
                  disabled={updateProfile.isPending}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="contained"
                onClick={() => setIsEditing(true)}
                sx={{ bgcolor: '#667eea' }}
              >
                Edit Profile
              </Button>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
```

### Organization Settings Page

```typescript
// src/app/admin/organization/page.tsx
import { Container, Grid, Typography } from '@mui/material';
import { OrganizationForm } from './components/OrganizationForm';
import { LogoUpload } from './components/LogoUpload';
import { MemberList } from './components/MemberList';
import { OrganizationStats } from './components/OrganizationStats';
import { usePermissions } from '~/hooks/usePermissions';
import { AccessDenied } from '~/components/AccessDenied';

export default function OrganizationPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('organization:edit')) {
    return <AccessDenied />;
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Organization Settings
      </Typography>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <LogoUpload />
        </Grid>

        <Grid item xs={12} md={8}>
          <OrganizationForm />
        </Grid>

        <Grid item xs={12}>
          <OrganizationStats />
        </Grid>

        <Grid item xs={12}>
          <MemberList />
        </Grid>
      </Grid>
    </Container>
  );
}
```

### Machine Management Page

```typescript
// src/app/machines/page.tsx
import { Container, Box, Typography, Button, Grid } from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { MachineList } from './components/MachineList';
import { MachineFilters } from './components/MachineFilters';
import { useRouter } from 'next/navigation';
import { usePermissions } from '~/hooks/usePermissions';

export default function MachinesPage() {
  const router = useRouter();
  const { hasPermission } = usePermissions();

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Typography variant="h4" component="h1">
          Machines
        </Typography>

        {hasPermission('machines:create') && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => router.push('/machines/new')}
            sx={{ bgcolor: '#667eea' }}
          >
            Add Machine
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <MachineFilters />
        </Grid>

        <Grid item xs={12} md={9}>
          <MachineList />
        </Grid>
      </Grid>
    </Container>
  );
}
```

### OPDB Search Component

```typescript
// src/app/machines/components/OPDBSearch.tsx
'use client';

import { useState } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Avatar,
  CircularProgress
} from '@mui/material';
import { api } from '~/lib/api';
import { useDebounce } from '~/hooks/useDebounce';

interface OPDBSearchProps {
  onSelect: (machine: any) => void;
  value?: any;
}

export function OPDBSearch({ onSelect, value }: OPDBSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const { data: searchResults, isLoading } = api.machine.opdb.search.useQuery(
    { query: debouncedSearchTerm },
    { enabled: debouncedSearchTerm.length > 2 }
  );

  return (
    <Autocomplete
      options={searchResults || []}
      getOptionLabel={(option) => option.name}
      loading={isLoading}
      value={value}
      onChange={(event, newValue) => {
        onSelect(newValue);
      }}
      onInputChange={(event, newInputValue) => {
        setSearchTerm(newInputValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search OPDB"
          placeholder="Type to search for machines..."
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props}>
          <Avatar
            src={option.image_url}
            alt={option.name}
            sx={{ mr: 2, width: 40, height: 40 }}
          />
          <Box>
            <Typography variant="body1">{option.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {option.manufacturer} • {option.release_date}
            </Typography>
          </Box>
        </Box>
      )}
      noOptionsText={
        searchTerm.length <= 2
          ? "Type at least 3 characters to search"
          : "No machines found"
      }
    />
  );
}
```

### Role-based Access Control Hook

```typescript
// src/hooks/usePermissions.ts
import { useCurrentUser } from "./useCurrentUser";
import { api } from "~/lib/api";

export function usePermissions() {
  const { user } = useCurrentUser();

  const { data: permissions = [] } = api.auth.permissions.useQuery(undefined, {
    enabled: !!user,
  });

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    return permissionList.some((permission) =>
      permissions.includes(permission),
    );
  };

  const hasAllPermissions = (permissionList: string[]): boolean => {
    return permissionList.every((permission) =>
      permissions.includes(permission),
    );
  };

  return {
    permissions,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
```

## Integration Points

### With Previous Phases

- **Authentication**: All admin features require proper authentication
- **Issue Management**: Machine ownership affects issue notifications
- **Dashboard**: Profile changes update dashboard user display

### With Backend APIs

- **User Management**: Full integration with user profile APIs
- **Organization APIs**: Complete organization management
- **Machine APIs**: OPDB integration and machine lifecycle
- **Location APIs**: Multi-tenant location management
- **Permission APIs**: Role-based access control

## Error Handling

### Form Validation

- **Client-side**: Real-time validation with React Hook Form
- **Server-side**: Backend validation with proper error messages
- **File Upload**: Progress indicators and error handling
- **Network Issues**: Retry logic with user feedback

### Permission Errors

- **Access Denied**: Clear messaging for insufficient permissions
- **Role Changes**: Handle permission changes gracefully
- **Session Expiry**: Redirect to login when session expires

## Testing Strategy

### Unit Tests

- [ ] Profile form validation and submission
- [ ] Organization settings management
- [ ] Machine CRUD operations
- [ ] Permission-based component rendering

### Integration Tests

- [ ] End-to-end user profile management
- [ ] Organization administration workflows
- [ ] Machine management with OPDB integration
- [ ] Role-based access control

### E2E Tests

- [ ] Complete admin workflow
- [ ] Multi-user role management
- [ ] File upload functionality
- [ ] Permission enforcement

## Success Criteria

### Functional Requirements

- [ ] Users can edit their profiles and preferences
- [ ] Admins can manage organization settings
- [ ] Machines can be created, edited, and deleted
- [ ] Locations can be managed with proper hierarchy
- [ ] Role-based permissions work correctly

### Technical Requirements

- [ ] No TypeScript errors
- [ ] All ESLint rules pass
- [ ] Mobile-responsive design
- [ ] Accessibility compliant
- [ ] Performance optimized

### User Experience

- [ ] Intuitive admin interfaces
- [ ] Clear permission feedback
- [ ] Smooth file upload experience
- [ ] Consistent with existing design
- [ ] Helpful error messages

## Dependencies

### External Libraries

- `@mui/material`: UI components
- `react-hook-form`: Form management
- `@hookform/resolvers`: Form validation
- `zod`: Schema validation

### Internal Dependencies

- All previous phases must be complete
- Backend APIs for user, organization, machine, and location management
- File upload system for avatars and logos

## Risk Mitigation

### Technical Risks

- **Complex Permissions**: Thorough testing of role-based access
- **File Upload**: Robust error handling and progress indicators
- **OPDB Integration**: Fallback for API failures
- **Mobile Experience**: Responsive design for all admin interfaces

### Timeline Risks

- **Admin Complexity**: Start with basic features and iterate
- **Integration Issues**: Early testing with backend APIs
- **User Experience**: Regular user testing and feedback

## Future Enhancements

### Post-Phase 4

- **Advanced Analytics**: Usage analytics and reporting
- **Audit Logging**: Track all administrative actions
- **Bulk Operations**: Mass updates for machines and users
- **Advanced Permissions**: Custom role creation

### V2.0 Features

- **Multi-organization**: Users managing multiple organizations
- **Advanced Workflows**: Approval processes for changes
- **Integration APIs**: Third-party system integration
- **White-label**: Custom branding for organizations

## Conclusion

Phase 4 completes the core PinPoint application by providing the administrative tools necessary for full operational control. By implementing comprehensive user management, organization administration, and machine management features, this phase enables organizations to fully utilize the PinPoint system.

The focus on role-based permissions ensures that features are appropriately restricted while maintaining the consistent visual design and user experience established in previous phases. The result is a complete, production-ready application that serves all user types from basic members to system administrators.
