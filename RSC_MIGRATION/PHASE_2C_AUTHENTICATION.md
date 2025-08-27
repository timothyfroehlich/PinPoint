# Phase 2C: Authentication Integration

**Goal**: Establish server-side authentication patterns with Supabase SSR for protected routes and authenticated user context in Server Components

**Success Criteria**:
- Server Component authentication validation with automatic redirects
- Protected route patterns with organization context resolution
- User session management with Next.js middleware integration
- Development authentication helpers for consistent testing

---

## Core Authentication Files

### Server Authentication Context (`src/lib/auth/server-auth.ts`)

**Purpose**: Server-side authentication utilities for Server Components and pages

```typescript
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";

export interface ServerAuthContext {
  user: {
    id: string;
    email: string;
    name?: string;
    profile_picture?: string;
    user_metadata?: {
      organizationId?: string;
      role?: string;
    };
  };
  organizationId: string;
  supabase: ReturnType<typeof createServerClient>;
}

// Create Supabase server client with proper cookie handling
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components can't set cookies
            // This will be handled by middleware
          }
        },
      },
    }
  );
}

// Get authenticated user context (optional - returns null if not logged in)
export const getServerAuth = cache(async (): Promise<ServerAuthContext | null> => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.warn("Auth error:", error.message);
      return null;
    }
    
    if (!user) {
      return null;
    }
    
    const organizationId = user.user_metadata?.organizationId;
    if (!organizationId) {
      console.warn("User has no organization context:", user.id);
      return null;
    }
    
    return {
      user: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || user.email!,
        profile_picture: user.user_metadata?.profile_picture,
        user_metadata: user.user_metadata
      },
      organizationId,
      supabase
    };
  } catch (error) {
    console.error("Server auth error:", error);
    return null;
  }
});

// Require authenticated user context (redirects if not logged in)
export const requireServerAuth = cache(async (): Promise<ServerAuthContext> => {
  const authContext = await getServerAuth();
  
  if (!authContext) {
    redirect("/auth/sign-in");
  }
  
  return authContext;
});

// Development authentication helper
export async function getDevAuthContext(): Promise<ServerAuthContext> {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Dev auth only available in development");
  }
  
  // Return mock auth context for development
  return {
    user: {
      id: "test-user-tim",
      email: "tim@austinpinball.com",
      name: "Tim Froehlich",
      user_metadata: {
        organizationId: "test-org-pinpoint",
        role: "admin"
      }
    },
    organizationId: "test-org-pinpoint",
    supabase: await createServerSupabaseClient()
  };
}

// Organization membership validation
export async function validateOrganizationAccess(
  userId: string, 
  organizationId: string
): Promise<boolean> {
  const supabase = await createServerSupabaseClient();
  
  // Check if user has membership in organization
  const { data: membership } = await supabase
    .from("memberships")
    .select("id, role")
    .eq("user_id", userId)
    .eq("organization_id", organizationId)
    .single();
  
  return !!membership;
}
```

### Authentication Middleware (`src/middleware.ts`)

**Purpose**: Next.js middleware for Supabase SSR and automatic token refresh

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "~/lib/auth/middleware-auth";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### Middleware Authentication Logic (`src/lib/auth/middleware-auth.ts`)

**Purpose**: Supabase SSR middleware integration with session management

```typescript
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  
  const { data: { user } } = await supabase.auth.getUser();

  // Protected routes that require authentication
  const protectedPaths = ["/dashboard", "/issues", "/machines", "/profile"];
  const isProtectedPath = protectedPaths.some(path => 
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !user) {
    // Redirect to sign in page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/sign-in";
    url.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Organization context validation for authenticated users
  if (user && isProtectedPath) {
    const organizationId = user.user_metadata?.organizationId;
    
    if (!organizationId) {
      // User needs to select an organization
      const url = request.nextUrl.clone();
      url.pathname = "/auth/select-organization";
      return NextResponse.redirect(url);
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you're
  // creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: NextResponse.next({ request })
  // 2. Copy over the cookies, like so: response.cookies.getAll().forEach(...)
  // 3. Change the response's status code if needed, like so: response.status = 200
  // Failing to do this will likely cause users to be randomly logged out.

  return supabaseResponse;
}
```

### Authentication Callback Route (`src/app/auth/callback/route.ts`)

**Purpose**: OAuth callback handling for authentication providers

```typescript
import { createClient } from "~/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;
  const redirectTo = requestUrl.searchParams.get("redirectTo") ?? "/dashboard";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      
      if (isLocalEnv) {
        // Development environment
        return NextResponse.redirect(`${origin}${redirectTo}`);
      } else if (forwardedHost) {
        // Production environment with forwarded host
        return NextResponse.redirect(`https://${forwardedHost}${redirectTo}`);
      } else {
        // Fallback to origin
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Error case - redirect to error page
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
```

---

## Protected Route Patterns

### Dashboard Page with Authentication (`src/app/dashboard/page.tsx`)

**Purpose**: Server Component with authentication validation

```tsx
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getIssuesForOrg, getOrgStats } from "~/lib/dal/issues";
import { getOrganizationById } from "~/lib/dal/organizations";
import { IssuesList } from "~/components/issues/issues-list-server";
import { DashboardStats } from "~/components/dashboard/dashboard-stats";

export async function generateMetadata() {
  const { user, organizationId } = await requireServerAuth();
  const organization = await getOrganizationById(organizationId);
  
  return {
    title: `Dashboard - ${organization.name}`,
    description: `Issue management dashboard for ${organization.name}`,
  };
}

export default async function DashboardPage() {
  // Authentication validation with automatic redirect
  const { user, organizationId } = await requireServerAuth();
  
  // Parallel data fetching with organization scoping
  const [organization, issues, orgStats] = await Promise.all([
    getOrganizationById(organizationId),
    getIssuesForOrg(organizationId),
    getOrgStats(organizationId)
  ]);
  
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user.name}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {organization.name}
        </div>
      </div>
      
      <DashboardStats stats={orgStats} />
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Recent Issues</h2>
        <IssuesList issues={issues.slice(0, 5)} />
        
        {issues.length > 5 && (
          <div className="mt-4">
            <a 
              href="/issues" 
              className="text-primary hover:underline"
            >
              View all {issues.length} issues →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Root Layout with Authentication Context (`src/app/layout.tsx`)

**Purpose**: Application shell with authentication and organization context

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerAuth } from "~/lib/auth/server-auth";
import { Navigation } from "~/components/layout/navigation";
import { AuthProvider } from "~/components/auth/auth-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Issue Tracking",
  description: "Professional pinball machine maintenance and issue tracking",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get authentication context (optional - doesn't redirect)
  const authContext = await getServerAuth();
  
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider initialAuth={authContext}>
          <div className="min-h-screen bg-background">
            <Navigation authContext={authContext} />
            <main className="container mx-auto px-4 py-8">
              {children}
            </main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## Implementation Steps

### 1. Server Authentication Setup
**Files**: `src/lib/auth/server-auth.ts`
- [ ] Create Supabase server client with cookie handling
- [ ] Implement `getServerAuth()` for optional authentication
- [ ] Create `requireServerAuth()` with automatic redirects
- [ ] Add development authentication helpers
- [ ] Implement organization membership validation

### 2. Middleware Integration
**Files**: `src/middleware.ts`, `src/lib/auth/middleware-auth.ts`
- [ ] Set up Next.js middleware with Supabase SSR
- [ ] Implement automatic token refresh
- [ ] Add protected route validation
- [ ] Create organization context validation
- [ ] Ensure proper cookie synchronization

### 3. Authentication Callback
**Files**: `src/app/auth/callback/route.ts`
- [ ] Create OAuth callback route handler
- [ ] Implement session exchange logic
- [ ] Add proper redirect handling
- [ ] Support development and production environments

### 4. Protected Route Implementation
**Files**: `src/app/dashboard/page.tsx`, `src/app/layout.tsx`
- [ ] Convert dashboard to Server Component with auth validation
- [ ] Add authentication context to root layout
- [ ] Implement metadata generation with org context
- [ ] Create navigation with auth-aware rendering

---

## Architectural Alignment

### Supabase SSR Integration
- ✅ **Server Components**: Authentication validated server-side
- ✅ **Cookie Management**: Proper getAll()/setAll() pattern
- ✅ **Middleware Required**: Automatic token refresh enabled
- ✅ **Session Integrity**: No logic between client creation and getUser()
- ✅ **Callback Route**: OAuth flow properly handled

### Server-First Authentication
- ✅ **React 19 cache()**: Authentication context cached per request
- ✅ **Organization Scoping**: Multi-tenant boundaries enforced
- ✅ **Progressive Enhancement**: Works without JavaScript
- ✅ **Development Experience**: Mock auth context for testing

---

## Dependencies & Prerequisites

### Complete Before Starting
- [x] Phase 2A: Data Access Layer (authentication utilities)
- [x] Phase 2B: Server Actions (authentication context integration)
- [x] Supabase project configured with OAuth providers

### Required for Next Phase
- [ ] Server authentication context operational
- [ ] Middleware token refresh working  
- [ ] Protected routes redirecting properly
- [ ] Organization context resolution validated

---

## Success Validation

### Authentication Flow Tests
- [ ] `/dashboard` redirects unauthenticated users to `/auth/sign-in`
- [ ] OAuth callback properly exchanges code for session
- [ ] Middleware refreshes tokens automatically
- [ ] Organization context extracted from user metadata
- [ ] Development auth helpers work in development mode

### Server Component Integration Tests
- [ ] `requireServerAuth()` provides user and organization context
- [ ] `getServerAuth()` returns null for unauthenticated users
- [ ] React cache() prevents duplicate authentication queries
- [ ] Protected pages render with proper user context
- [ ] Metadata generation includes organization information

### Security Tests
- [ ] Cross-organization access properly denied
- [ ] Session integrity maintained across requests
- [ ] Middleware doesn't break authentication state
- [ ] Cookie synchronization works correctly
- [ ] Authentication context propagates through Server Components

---

**Next Phase**: [Phase 2D: Issue Management Server Components](./PHASE_2D_ISSUE_MANAGEMENT.md)

**User Goal Progress**: Authentication integration provides the security foundation for protected routes and user context needed for the authenticated dashboard experience.