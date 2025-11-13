# Task 6.5: Navigation Framework

**Status**: ⏳ PENDING
**Branch**: `feat/navigation-framework`
**Dependencies**: Task 6 (Authentication Pages)

## Objective

Top navigation bar with user menu, logo, auth state handling, and quick links for authenticated users.

## Acceptance Criteria

- [ ] Unauthenticated users see Sign In/Sign Up buttons
- [ ] Authenticated users see quick links and user menu
- [ ] User avatar displays with initials fallback
- [ ] User menu opens and closes correctly
- [ ] All navigation links work
- [ ] Logout works from user menu
- [ ] Works on mobile (responsive, may hide some quick links)
- [ ] All tests pass

## Tasks

### Navigation Component

- [ ] Create `src/components/layout/navigation.tsx` (Server Component)
  - Fetch auth user in component
  - Conditional rendering based on auth state
  - Use Material Design 3 colors from globals.css

### Unauthenticated Navigation

- [ ] Unauthenticated state shows:
  - "PinPoint" logo/text (links to /)
  - Sign In button (links to /auth/login)
  - Sign Up button (links to /auth/signup)
  - Use `bg-surface` and `border-outline-variant`

### Authenticated Navigation

- [ ] Authenticated state shows:
  - "PinPoint" logo/text (links to /dashboard)
  - Quick Links section (center):
    - Issues button (links to /issues) - AlertTriangleIcon
    - Report Issue button (links to /issues/new) - PlusIcon
    - Machines button (links to /machines) - WrenchIcon
  - User section (right):
    - User name display
    - User avatar (use shadcn Avatar component)
    - User dropdown menu (see below)
  - Use `bg-primary-container` with `text-on-primary-container`

### User Menu Component

- [ ] Create `src/components/layout/user-menu-client.tsx` (Client Component)
  - Use shadcn DropdownMenu
  - Avatar trigger with ChevronDown icon
  - Menu items:
    - Profile (UserIcon) - links to /profile (future)
    - Settings (SettingsIcon) - links to /settings (future)
    - Separator
    - Sign Out (LogOutIcon, text-error) - form with logout Server Action

### Root Layout Integration

- [ ] Update `src/app/layout.tsx`
  - Import Navigation component
  - Place above main content
  - Pass auth context (from server)
- [ ] Install lucide-react icons if not installed
  - `npm install lucide-react`

### Pattern Documentation

- [ ] Update `docs/PATTERNS.md`
  - Navigation auth state pattern
  - Server Component + Client Component composition
  - User menu dropdown pattern

### Tests

- [ ] Integration test: Navigation renders correctly for unauthenticated user
- [ ] Integration test: Navigation renders correctly for authenticated user
- [ ] E2E test: User menu dropdown works
- [ ] E2E test: Logout from user menu works

## Key Decisions

1. **Navigation Placement**: Full-width navigation bar at top of all pages except auth pages (which have their own centered layout)
2. **Auth Redirect**: Authenticated users are redirected from `/` to `/dashboard` automatically
3. **Placeholder Routes**: Now show "Coming Soon" placeholder pages for `/issues`, `/issues/new`, and `/machines` (previously would 404)
4. **Mobile Quick Links**:
   - Issues and Report Issue always visible (icon-only on mobile, text shown on sm+)
   - Machines hidden on mobile (only visible on sm+ screens)
   - User info (name/email) hidden on mobile in dropdown trigger
5. **User Data Source**: Using `user.user_metadata` for user name (consistent with dashboard pattern)
6. **Auth Pages Exclusion**: Auth pages use `(auth)` route group with own layout, so Navigation automatically excluded

## Mobile UX - Needs Review

**TODO**: Review mobile navigation behavior for additional quick links as they're added:

- Current: Issues (always visible), Report Issue (always visible), Machines (hidden on mobile)
- Question: Should we add a mobile menu/hamburger for additional links in the future, or continue hiding less critical links on mobile?

## Problems Encountered

1. **No Supabase running for build**: Build failed initially because `DATABASE_URL` not set in local environment. Not a real problem - build requires Supabase connection. Solution: Use `.env.ci` for CI builds, local dev uses `.env.local`.

2. **User menu trigger selector complexity**: E2E tests needed specific selectors to find user menu button (has avatar, name, and chevron). Solution: Used `locator('button:has(svg)').filter({ has: page.locator('text="Member User"') })` to target the right element.

## Lessons Learned

### 1. Server/Client Component Split Reduces Bundle Size

**Pattern**: Server Component fetches data, Client Component handles interactivity
**Benefit**: Only the dropdown menu requires JavaScript, rest is static HTML
**Cost**: Slight complexity with prop drilling (userName, userEmail)
**Verdict**: Worth it - follows Next.js 16 + React 19 best practices

### 2. Route Groups for Layout Exclusion

**Pattern**: Auth pages use `(auth)` route group with own layout
**Benefit**: Navigation automatically excluded, no conditional logic needed
**Alternative Rejected**: Conditional rendering based on pathname (more complex)

### 3. Mobile-First Quick Links Need Strategy

**Current**: Icon-only buttons on mobile, text labels on desktop
**Works For**: 2-3 quick links (Issues, Report, Machines)
**Doesn't Scale**: Beyond 4-5 links, navbar gets crowded
**Added to**: `tasks/REVISIT.md` - revisit when adding 4th+ link

### 4. User Data Source Has Future Implications

**Current**: Using `user.user_metadata["name"]` (no DB query)
**Limitation**: Can't be updated by user (metadata is read-only)
**Future**: Switch to `user_profiles` table when profile editing is added (Task 9.5)
**Added to**: `tasks/REVISIT.md` - document the tradeoff

### 5. Progressive Enhancement with Server Actions

**Pattern**: Logout is a `<form action={serverAction}>` not `onClick`
**Benefit**: Works without JavaScript, follows NON_NEGOTIABLES.md
**Consistency**: Matches all other forms in the app (login, signup)

### 6. Placeholder Pages Better Than 404s

**Decision**: Created "Coming Soon" pages instead of letting routes 404
**Benefit**: Tests pass, links work, users see feature is planned
**Pattern**: Auth guards in place from day 1, ready for implementation

## Updates for CLAUDE.md

**For future agents:**

### Navigation Component Available

- **Location**: `src/components/layout/navigation.tsx` (Server Component)
- **Usage**: Already in root layout, appears on all pages except `(auth)` route group
- **Auth State**: Automatically fetches user and renders conditionally
- **Styling**: Material Design 3 colors (`bg-primary-container` when authenticated)

### User Menu Pattern

- **Location**: `src/components/layout/user-menu-client.tsx` (Client Component)
- **Props**: `userName: string`, `userEmail: string`
- **Avatar**: Initials fallback (extracts from userName)
- **Future Items**: Profile and Settings are disabled with "(Soon)" label
- **Logout**: Uses Server Action with progressive enhancement

### Protected Routes Pattern

```typescript
// Any page that requires auth
const supabase = await createClient();
const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  redirect("/login");
}
```

### Placeholder Routes Available

- `/issues` - Issues list (protected, "Coming Soon")
- `/issues/new` - Report new issue (protected, "Coming Soon")
- `/machines` - Machines list (protected, "Coming Soon")

**Note**: When implementing these routes, auth guards are already in place.

### Mobile Responsive Strategy

- Quick links use `hidden sm:inline` for text labels (icon-only on mobile)
- Less critical links use `hidden sm:flex` to hide entirely on mobile
- User info in dropdown trigger hidden on mobile (`hidden sm:block`)

**See**: `tasks/REVISIT.md` for mobile navigation scaling strategy

### Tradeoffs Documented

Key decisions that will need revisiting:

1. **User data source** - Using `user_metadata` (revisit when adding profile editing)
2. **Mobile quick links** - Current approach doesn't scale beyond 4-5 links
3. **Logo behavior** - Authenticated users can't access landing page (revisit when adding public content)

**See**: `tasks/REVISIT.md` for full details and trigger conditions
