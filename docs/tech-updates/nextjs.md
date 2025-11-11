# Next.js: App Router & Caching Revolution

_Server Components, Server Actions, and critical caching changes for full-stack architecture_

## 🚨 CRITICAL BREAKING CHANGES (Next.js 16 - 2025)

### **Caching Defaults Completely Changed**

**BREAKING:** Next.js 16 (since 15) fundamentally changed caching behavior - **defaults are now UNCACHED**:

- **fetch requests** now default to `cache: "no-store"` (uncached)
- **GET Route Handlers** now default to uncached behavior
- **Client Router Cache** now defaults to uncached for page segments

**Migration Impact:** Previous aggressive caching is GONE. Explicit cache configuration now required for performance.

```typescript
// BEFORE Next.js 16 (v14 and earlier): fetch was cached by default
const data = await fetch("https://api.example.com/posts"); // ✅ Cached automatically

// AFTER Next.js 16 (since 15): fetch is uncached by default
const data = await fetch("https://api.example.com/posts"); // ❌ Not cached!

// REQUIRED: Explicit caching for performance
const data = await fetch("https://api.example.com/posts", {
  cache: "force-cache", // ✅ Must specify to cache
});
```

### **PinPoint Migration Impact**

**FOR PINPOINT:** Review all `fetch()` calls and data fetching patterns immediately:

```typescript
// Update all DAL functions for performance
export async function getIssuesForOrg(organizationId: string) {
  // Add explicit caching for frequently accessed data
  const response = await fetch(`/api/issues?org=${organizationId}`, {
    cache: "force-cache",
    next: { revalidate: 60 }, // Cache for 60 seconds
  });
  return response.json();
}

// Or use React 19 cache() for request-level memoization
import { cache } from "react";
export const getIssuesForOrg = cache(async (organizationId: string) => {
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId),
  });
});
```

### **New APIs in Next.js 16**

**Form Component & unstable_after API**

```typescript
import { Form } from "next/form"

// NEW: Built-in Form component with better defaults
export function IssueForm() {
  return (
    <Form action={createIssueAction}>
      <input name="title" required />
      <input name="description" />
      <button type="submit">Create Issue</button>
    </Form>
  )
}

// NEW: unstable_after for background tasks
"use server"
import { unstable_after } from "next/server"

export async function createIssueAction(formData: FormData) {
  const issue = await createIssue(formData)

  // Run after response is sent to user
  unstable_after(async () => {
    await sendNotificationEmail(issue)
    await updateAnalytics(issue)
  })

  redirect(`/issues/${issue.id}`)
}
```

**TypeScript Improvements**

- **Typed Routes**: Better type safety for `href` props
- **Turbopack Beta**: Faster development builds
- **Enhanced DevTools**: Better debugging for Server Components

---

## Key Architecture Changes (2024-2025)

### 🚨 **Paradigm Shift: Server-Centric Architecture**

**App Router vs Pages Router**

- **DO:** Use App Router for all new development
- **DON'T:** Start new projects with Pages Router
- **Migration Impact:** Complete rewrite of data fetching, routing, and state management

**Server Components Revolution**

- **DO:** Fetch data directly in async Server Components
- **DON'T:** Use `useEffect` or `getServerSideProps` patterns
- **Migration Benefit:** Eliminate client-server waterfalls, reduce bundle size

### ⚡ **New Data Paradigms**

**Server Actions for Mutations**

```typescript
// OLD: API Routes + fetch
await fetch("/api/posts", { method: "POST", body: JSON.stringify(data) });

// NEW: Direct Server Actions
async function createPost(formData: FormData) {
  "use server";
  await db.insert(posts).values({ title: formData.get("title") });
  revalidatePath("/posts");
}
```

**Request-Level Caching with React 19 cache()**

- **DO:** Use React 19's `cache()` API for request-level memoization
- **DON'T:** Rely on client-side caching libraries for server data
- **Migration Benefit:** Request-level memoization prevents duplicate DB queries

**Streaming & Suspense Integration**

- **DO:** Wrap slow components in `<Suspense>` boundaries
- **DON'T:** Block entire page rendering for slow components
- **Migration Impact:** Progressive rendering, better perceived performance

### 🔄 **Caching & Revalidation**

**Granular Cache Control**

```typescript
// Static-like caching
fetch("https://...", { cache: "force-cache" });

// Dynamic (SSR-like) behavior
fetch("https://...", { cache: "no-store" });

// Time-based revalidation
fetch("https://...", { next: { revalidate: 60 } });

// Tag-based invalidation
fetch("https://...", { next: { tags: ["posts"] } });
```

**On-Demand Revalidation**

- **DO:** Use `revalidatePath()` and `revalidateTag()` in Server Actions
- **DON'T:** Rely on time-based revalidation for user-triggered updates
- **Migration Benefit:** Immediate cache invalidation after mutations

## Migration Patterns

### Data Fetching Evolution

**From `getServerSideProps` to Server Components**

```typescript
// OLD: Pages Router
export async function getServerSideProps() {
  const posts = await fetch('https://...').then(r => r.json())
  return { props: { posts } }
}

// NEW: App Router
export default async function PostsPage() {
  const posts = await fetch('https://...').then(r => r.json())
  return <PostsList posts={posts} />
}
```

**From API Routes to Server Actions**

```typescript
// OLD: pages/api/posts.ts
export default async function handler(req, res) {
  if (req.method === "POST") {
    const post = await createPost(req.body);
    res.json(post);
  }
}

// NEW: Server Action
async function createPost(formData: FormData) {
  "use server";
  const post = await db.insert(posts).values({
    title: formData.get("title"),
    content: formData.get("content"),
  });
  revalidatePath("/posts");
  return post;
}
```

### Component Patterns

**Server vs Client Component Decision Tree**

- **Server Component:** Data fetching, static rendering, SEO content
- **Client Component:** User interaction, browser APIs, state management

**Streaming with Suspense**

```typescript
export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      {/* Immediate render */}

      <Suspense fallback={<SkeletonLoader />}>
        <SlowDataComponent />
      </Suspense>
      {/* Streamed when ready */}
    </div>
  )
}

async function SlowDataComponent() {
  const data = await fetchSlowData()
  return <DataVisualization data={data} />
}
```

### Advanced Caching Strategies

**Request Memoization with React 19 cache()**

```typescript
import { cache } from "react"

const getUser = cache(async (id: string) => {
  // Memoized within single request - no duplicate queries
  const user = await db.query.users.findFirst({
    where: eq(users.id, id)
  })
  return user
})

// Called multiple times in same request = only 1 DB query
export default async function UserProfile({ userId }: { userId: string }) {
  const user = await getUser(userId)        // DB query executed
  const posts = await getUserPosts(userId)  // May also call getUser()
  const profile = await getUser(userId)     // Cache hit, no additional query!

  return <ProfileView user={user} posts={posts} />
}
```

**Tag-Based Cache Invalidation**

```typescript
// Fetch with tags
async function getPosts() {
  const response = await fetch("/api/posts", {
    next: { tags: ["posts"] },
  });
  return response.json();
}

// Invalidate specific tag in Server Action
async function createPost(formData: FormData) {
  "use server";
  await db.insert(posts).values({
    /* ... */
  });
  revalidateTag("posts"); // Only invalidate posts-related cache
}
```

## Route Organization

### File-Based Nested Layouts

```
app/
├── layout.tsx          # Root layout (all routes)
├── page.tsx           # Home page
├── dashboard/
│   ├── layout.tsx     # Dashboard layout
│   ├── page.tsx       # Dashboard home
│   ├── analytics/
│   │   └── page.tsx   # Analytics page
│   └── settings/
│       └── page.tsx   # Settings page
└── api/               # API routes (when needed)
```

### Loading & Error Boundaries

```
dashboard/
├── layout.tsx
├── page.tsx
├── loading.tsx        # Loading UI for dashboard/*
├── error.tsx          # Error boundary
└── analytics/
    ├── page.tsx
    └── loading.tsx    # Specific loading for analytics
```

## Server Actions Best Practices

### Form Integration

```typescript
// actions.ts
'use server'
export async function updateProfile(formData: FormData) {
  const name = formData.get('name') as string
  const email = formData.get('email') as string

  await db.update(users).set({ name, email }).where(eq(users.id, userId))
  revalidatePath('/profile')
}

// profile-form.tsx
import { updateProfile } from './actions'

export function ProfileForm() {
  return (
    <form action={updateProfile}>
      <input name="name" required />
      <input name="email" type="email" required />
      <button type="submit">Update Profile</button>
    </form>
  )
}
```

### Progressive Enhancement

```typescript
'use client'
import { updateProfile } from './actions'
import { useFormStatus } from 'react-dom'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending}>
      {pending ? 'Updating...' : 'Update Profile'}
    </button>
  )
}

export function EnhancedProfileForm() {
  return (
    <form action={updateProfile}>
      <input name="name" required />
      <input name="email" type="email" required />
      <SubmitButton />
    </form>
  )
}
```

## Testing Server Components & Actions

### Component Testing

```typescript
// Can't unit test async Server Components directly
// Use E2E tests with Playwright for full flows

// For Server Actions, test the action directly
import { describe, it, expect } from "vitest";
import { createPost } from "./actions";

describe("createPost", () => {
  it("should create post and revalidate", async () => {
    const formData = new FormData();
    formData.set("title", "Test Post");
    formData.set("content", "Test content");

    const result = await createPost(formData);
    expect(result).toBeDefined();
  });
});
```

### Mocking Strategy

```typescript
// Mock Server Actions in component tests
vi.mock("./actions", () => ({
  createPost: vi.fn().mockResolvedValue({ id: 1 }),
}));

// Mock fetch for data fetching
global.fetch = vi.fn().mockResolvedValue({
  json: () => Promise.resolve({ posts: [] }),
});
```

## Migration Checklist

### 🚨 Phase 0: CRITICAL Caching Review (IMMEDIATE)

- [ ] **Audit all fetch() calls**: Review every data fetching pattern in the application
- [ ] **Add explicit caching**: Set `cache: "force-cache"` for frequently accessed data
- [ ] **Performance testing**: Measure impact of uncached defaults
- [ ] **React 19 cache() migration**: Replace repeated queries with request-level memoization

### Phase 1: App Router Setup

- [ ] Create `app/` directory structure
- [ ] Move root layout from `_app.js` to `app/layout.tsx`
- [ ] Convert pages to `page.tsx` files in folders

### Phase 2: Data Fetching Migration

- [ ] Replace `getServerSideProps` with async Server Components
- [ ] Replace `getStaticProps` with cached `fetch()` calls **with explicit caching**
- [ ] Convert API routes to Server Actions where appropriate
- [ ] Implement React 19 `cache()` for request-level memoization

### Phase 3: Component Updates

- [ ] Add `'use client'` directive to interactive components
- [ ] Wrap slow components with `<Suspense>` boundaries
- [ ] Implement loading and error states

### Phase 4: Modern API Integration

- [ ] Use Next.js Form component for better form handling
- [ ] Implement `unstable_after` for background tasks
- [ ] Set up tag-based revalidation with `revalidateTag`
- [ ] Optimize with TypeScript route typing

## Common Gotchas

**Server vs Client Boundaries**

- ❌ Can't pass functions from Server to Client Components
- ✅ Pass Server Actions as props to Client Components
- ❌ Can't use browser APIs in Server Components
- ✅ Use `'use client'` for interactive components

**Async Component Patterns**

- ❌ Can't `await` in non-async components
- ✅ Make Server Components `async` for data fetching
- ❌ Don't use `useEffect` for server data in Server Components

**Streaming Considerations**

- Always provide meaningful loading states
- Wrap dynamic components in `<Suspense>`
- Consider request waterfalls with sequential data fetching

## Next Steps

1. **Set up App Router** in existing project or new projects
2. **Convert data fetching** from hooks/getServerSideProps to Server Components
3. **Implement Server Actions** for mutations to replace API routes
4. **Add streaming** with Suspense for better perceived performance
5. **Optimize caching** with tags and on-demand revalidation

_Full examples and migration patterns in [tech-stack-research-catchup.md](../tech-stack-research-catchup.md)_
