## Overview

Comprehensive user profile system with image management, default profile pictures, and game ownership tracking.

## Database Schema Changes

### User Model Updates

```plain text
model User {
    id            String       @id @default(cuid())
    name          String?
    email         String?      @unique
    bio           String?      // New: User biography/description
    profilePicture String?     // New: Path to profile picture
    joinDate      DateTime     @default(now()) // New: Account creation date

    emailVerified DateTime?
    image         String?
    accounts      Account[]
    sessions      Session[]
    memberships   Membership[]
    issues        Issue[]
    comments      Comment[]
    ownedGameInstances GameInstance[] @relation("GameOwner") // New: Games owned by user
}

```

### GameInstance Model Updates

```plain text
model GameInstance {
    id           String    @id @default(cuid())
    name         String
    gameTitle    GameTitle @relation(fields: [gameTitleId], references: [id])
    gameTitleId  String
    location     Location  @relation(fields: [locationId], references: [id])
    locationId   String
    owner        User?     @relation("GameOwner", fields: [ownerId], references: [id]) // New
    ownerId      String?   // New: Optional owner
    issues       Issue[]
}

```

## Image Storage System Architecture

### Core Interface

```typescript
interface ImageStorageProvider {
  uploadImage(file: File, path: string): Promise<string>;
  deleteImage(path: string): Promise<void>;
  getImageUrl(path: string): string;
  validateImage(file: File): Promise<boolean>;
}
```

### Local Storage Implementation

```typescript
class LocalImageStorage implements ImageStorageProvider {
  private basePath = "/uploads/images";
  private maxSize = 5 * 1024 * 1024; // 5MB

  // Auto-compression and validation
  // File naming: user-{userId}-{timestamp}.webp
}
```

### Image Processing Pipeline

1. **Client-side validation** (file type, size)
2. **Client-side compression** (resize to max 400x400, convert to WebP)
3. **Server-side validation** (security checks)
4. **Storage with unique naming** (prevent conflicts)

## Backend API (tRPC)

### User Router

```typescript
export const userRouter = createTRPCRouter({
  // Get current user profile
  getProfile: protectedProcedure.query()

  // Update user profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().optional(),
      bio: z.string().max(500).optional(),
    }))
    .mutation()

  // Upload profile picture
  uploadProfilePicture: protectedProcedure
    .input(z.object({ imageData: z.string() }))
    .mutation()

  // Get user by ID (public info only)
  getUser: organizationProcedure
    .input(z.object({ userId: z.string() }))
    .query()
})

```

### GameInstance Router Updates

```typescript
// Add owner assignment to existing gameInstance router
assignOwner: organizationProcedure
  .input(
    z.object({
      gameInstanceId: z.string(),
      ownerId: z.string().optional(), // null to remove owner
    }),
  )
  .mutation();
```

## Frontend Components

### 1. User Profile Page (`/profile`)

**Location**: `src/app/profile/page.tsx`

```typescript
// Features:
// - Display user info (name, email, bio, join date)
// - Profile picture with upload capability
// - Edit profile form
// - List of owned games
// - User statistics (games owned, issues reported, etc.)
```

### 2. Profile Picture Upload Component

**Location**: `src/app/_components/profile-picture-upload.tsx`

```typescript
// Features:
// - Drag & drop or click to upload
// - Real-time preview
// - Auto-compression
// - Progress indicator
// - Error handling
```

### 3. Updated AuthButton Component

**Location**: `src/app/_components/auth-button.tsx`

```typescript
// Current: Shows "Sign In" or basic user info
// Updated: Shows user avatar, name, dropdown menu with:
// - Profile link
// - Settings (future)
// - Sign out
```

### 4. User Avatar Component

**Location**: `src/app/_components/user-avatar.tsx`

```typescript
// Reusable avatar component with:
// - Fallback to default profile pics
// - Size variants (small, medium, large)
// - Loading states
// - Error handling
```

## Default Profile Pictures

### Source: IPDB Top Solid State Games Translites

1. **Twilight Zone** (Bally, 1993)
2. **Theatre of Magic** (Bally, 1995)
3. **Star Trek: The Next Generation** (Williams, 1993)
4. **Medieval Madness** (Williams, 1997)
5. **Attack from Mars** (Bally, 1995)
6. **Eight Ball Deluxe** (Bally, 1981)
7. **Xenon** (Bally, 1980)
8. **Fathom** (Bally, 1981)
9. **Firepower** (Williams, 1980)
10. **Monster Bash** (Williams, 1998)

### Implementation

- Store in `public/images/default-avatars/`
- Randomly assign to new users during creation
- Crop to circular format, optimize for web
- Format: `default-avatar-{1-10}.webp`

## Seed Data Expansion

### Additional Test Users

```typescript
const testUsers = [
  {
    name: "Alice Cooper",
    email: "testdev-alice@fake.com",
    bio: "Pinball wizard since 1975",
  },
  {
    name: "Bob Dylan",
    email: "testdev-bob@fake.com",
    bio: "Rolling down the line",
  },
  {
    name: "Charlie Parker",
    email: "testdev-charlie@fake.com",
    bio: "Jazz hands on silver balls",
  },
  {
    name: "Diana Ross",
    email: "testdev-diana@fake.com",
    bio: "Supreme flipper skills",
  },
  {
    name: "Elvis Presley",
    email: "testdev-elvis@fake.com",
    bio: "King of the arcade",
  },
  {
    name: "Freddie Mercury",
    email: "testdev-freddie@fake.com",
    bio: "We will rock you... and tilt",
  },
  {
    name: "Grace Hopper",
    email: "testdev-grace@fake.com",
    bio: "Debugging pinball code since 1940",
  },
  {
    name: "Hendrix Jimi",
    email: "testdev-hendrix@fake.com",
    bio: "Purple haze on the playfield",
  },
];
```

### Game Ownership Assignment

- Randomly assign 2-3 games per test user
- Ensure some games have multiple owners (co-ownership)
- Leave some games unowned for testing

## Navigation & UX Enhancements

### Header Navigation Updates

```typescript
// Current: PinPoint logo + AuthButton
// Updated: PinPoint logo + User menu with:
// - Profile picture + name
// - Dropdown: Profile, Settings, Sign Out
```

### Breadcrumb System

**Location**: `src/app/_components/breadcrumbs.tsx`

```typescript
// Game Management > Game Instances > MM #1 > Owner: Alice Cooper
// Profile > Edit Profile
// Profile > Upload Picture
```

### User Links Throughout App

- Game instance lists show owner avatars/names as clickable links
- Issue reporters show as user links
- Comment authors show as user links

## File Structure

```plain text
src/
├── app/
│   ├── profile/
│   │   ├── page.tsx                 # Main profile page
│   │   ├── edit/page.tsx           # Edit profile page
│   │   └── [userId]/page.tsx       # View other user's profile
│   ├── _components/
│   │   ├── user-avatar.tsx         # Reusable avatar component
│   │   ├── profile-picture-upload.tsx
│   │   ├── breadcrumbs.tsx
│   │   └── auth-button.tsx         # Updated with user menu
│   └── api/
│       └── upload/
│           └── route.ts            # Image upload endpoint
├── lib/
│   ├── image-storage/
│   │   ├── index.ts                # Storage provider interface
│   │   ├── local-storage.ts        # Local implementation
│   │   └── image-utils.ts          # Compression utilities
│   └── utils/
│       └── image-processing.ts     # Client-side utilities
├── server/api/routers/
│   ├── user.ts                     # User profile management
│   └── gameInstance.ts             # Updated with owner assignment
└── public/
    └── images/
        └── default-avatars/        # Default profile pictures
            ├── default-avatar-1.webp
            ├── default-avatar-2.webp
            └── ...

```

## Implementation Order

1. **Database Migration** - Update schema, run migration
2. **Image Storage System** - Core infrastructure
3. **Default Profile Pictures** - Download and process translites
4. **Backend APIs** - User router, upload endpoint
5. **Seed Data** - Expand with new test users
6. **Frontend Components** - Avatar, profile pages, navigation
7. **Integration** - Connect owner assignment to game instances
8. **Testing** - Full user flow testing

## Technical Considerations

### Image Security

- MIME type validation
- File size limits (5MB)
- Image dimension limits
- Sanitize file names
- Scan for malicious content

### Performance

- WebP format for optimal compression
- Lazy loading for avatar grids
- CDN preparation for future cloud migration
- Progressive image loading

### Accessibility

- Alt text for all images
- Keyboard navigation for dropdowns
- Screen reader friendly labels
- High contrast avatar fallbacks

### Future Cloud Migration

- Abstract storage interface allows easy swap
- Configuration-based provider selection
- Batch migration tools for existing local images
- URL transformation utilities

## Success Criteria

- ✅ Users can upload and display profile pictures
- ✅ Image storage is modular and cloud-ready
- ✅ Default avatars provide good UX for new users
- ✅ Game ownership is clearly displayed and manageable
- ✅ User profiles are informative and editable
- ✅ Navigation is intuitive with proper breadcrumbs
- ✅ All images are properly optimized and secure
