# Phase 1D: Layout System Conversion

## 📋 Overview

**Goal**: Convert client-heavy layout system to server-first architecture with minimal client islands for interactivity

**Current State**:
- MUI-based layout with `AppShell` and complex navigation
- Client-side authentication context (`AuthProvider`)
- Heavy client-side state management for navigation
- Hydration safety mechanisms (`useClientMounted`)

**Target State**:
- Server Component layout with auth context from server
- Minimal client islands for interactive elements
- Static navigation with server-rendered user context
- Eliminates hydration mismatches and reduces bundle size

## 🎯 Implementation Plan

### Step 1: Supabase Client Utilities (2025 SSR Patterns)

**Create `src/utils/supabase/server.ts`** (CRITICAL - Server-side client):
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
```

**Create `src/utils/supabase/client.ts`** (CRITICAL - Client-side client):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Create `src/utils/supabase/middleware.ts`** (CRITICAL - Session refresh):
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: DO NOT run code between createServerClient and supabase.auth.getUser()
  // A simple mistake could make it very hard to debug issues with users being randomly logged out.

  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (
    !user &&
    !request.nextUrl.pathname.startsWith('/login') &&
    !request.nextUrl.pathname.startsWith('/auth')
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return supabaseResponse
}
```

**Create `middleware.ts`** (REQUIRED - Root level):
```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Create `src/app/auth/callback/route.ts`** (REQUIRED - OAuth flow completion):
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`http://localhost:3000${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${request.nextUrl.origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${request.nextUrl.origin}/auth/auth-code-error`)
}
```

**Create `.env.local`** (REQUIRED - Environment setup):
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 2: Server-Side Auth Context

**Create `src/lib/auth/server-context.ts`**:
```typescript
import { createClient } from "~/utils/supabase/server";
import { redirect } from "next/navigation";
import { cache } from "react";

// Cached server-side auth check (React 19 cache API)
export const getServerAuth = cache(async () => {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  const organizationId = user.user_metadata?.organizationId;
  const organizationName = user.user_metadata?.organizationName;

  return {
    user: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name || user.email!,
      avatarUrl: user.user_metadata?.avatarUrl,
    },
    organization: organizationId ? {
      id: organizationId,
      name: organizationName || 'Unknown Organization',
    } : null,
  };
});

// Auth requirement helper for layouts
export async function requireServerAuth() {
  const auth = await getServerAuth();
  if (!auth) {
    redirect("/auth/sign-in");
  }
  return auth;
}

// Organization requirement helper
export async function requireServerOrgContext() {
  const auth = await requireServerAuth();
  if (!auth.organization) {
    redirect("/onboarding");
  }
  return auth;
}
```

### Step 2: Server Navigation Components

**Create `src/components/layout/ServerNavigation.tsx`**:
```typescript
import { Suspense } from "react";
import Link from "next/link";
import { getServerAuth } from "~/lib/auth/server-context";
import { UserMenuClient } from "./client/UserMenuClient";
import { MobileNavToggle } from "./client/MobileNavToggle";
import { NavigationSkeleton } from "./NavigationSkeleton";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";

interface NavItem {
  label: string;
  href: string;
  icon: string; // Lucide icon name
  permissions?: string[];
}

const navigationItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { label: "Issues", href: "/issues", icon: "AlertCircle" },
  { label: "Machines", href: "/machines", icon: "Cpu" },
  { label: "Locations", href: "/locations", icon: "MapPin" },
  { label: "Reports", href: "/reports", icon: "BarChart3" },
  { label: "Settings", href: "/settings", icon: "Settings" },
];

async function NavigationContent() {
  const auth = await getServerAuth();
  
  if (!auth) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card>
          <CardContent className="pt-6">
            <Button asChild>
              <Link href="/auth/sign-in">
                Sign In
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Organization Header */}
      <div className="p-4 border-b bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">
              {auth.organization?.name || 'PinPoint'}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {auth.user.name}
            </p>
          </div>
          
          {/* Mobile menu toggle */}
          <div className="md:hidden">
            <MobileNavToggle />
          </div>
        </div>
      </div>
      
      <Separator />

      {/* Navigation Links */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigationItems.map((item) => (
          <NavigationLink key={item.href} item={item} />
        ))}
      </nav>

      <Separator />
      
      {/* User Menu */}
      <div className="p-4">
        <UserMenuClient user={auth.user} />
      </div>
    </div>
  );
}

function NavigationLink({ item }: { item: NavItem }) {
  return (
    <Button variant="ghost" className="w-full justify-start h-10" asChild>
      <Link href={item.href}>
        {/* Icon would be rendered here based on item.icon */}
        <span className="ml-3">{item.label}</span>
      </Link>
    </Button>
  );
}

export function ServerNavigation() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r">
      <Suspense fallback={<NavigationSkeleton />}>
        <NavigationContent />
      </Suspense>
    </aside>
  );
}
```

### Step 3: Client Island Components

**Create `src/components/layout/client/UserMenuClient.tsx`** (Updated for 2025):
```typescript
"use client";

import { useState } from "react";
import { createClient } from "~/utils/supabase/client"; // Uses createBrowserClient internally
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { User, Settings, LogOut } from "lucide-react";

interface UserMenuClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
  };
}

export function UserMenuClient({ user }: UserMenuClientProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // Next.js will handle the redirect via middleware
      window.location.href = '/auth/sign-in';
    } catch (error) {
      console.error('Sign out error:', error);
      setIsLoading(false);
    }
  };

  const initials = user.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="w-full justify-start px-3 py-2 h-auto">
          <div className="flex items-center space-x-3 w-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium truncate">
                {user.name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user.email}
              </div>
            </div>
          </div>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div>
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <a href="/profile" className="flex items-center">
            <User className="mr-2 h-4 w-4" />
            Profile
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <a href="/settings" className="flex items-center">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </a>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem
          onClick={handleSignOut}
          disabled={isLoading}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {isLoading ? 'Signing out...' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Create `src/components/layout/client/MobileNavToggle.tsx`**:
```typescript
"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Menu } from "lucide-react";

export function MobileNavToggle() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <div className="flex flex-col h-full">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-left">Navigation</SheetTitle>
          </SheetHeader>
          <div className="flex-1 p-4">
            {/* Navigation items would be rendered here */}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

### Step 4: Updated Root Layout

**Update `src/app/layout.tsx`**:
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ServerNavigation } from "~/components/layout/ServerNavigation";
import { ClientProviders } from "./client-providers";
import { Toaster } from "~/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PinPoint - Pinball Machine Management",
  description: "Manage your pinball machines, track issues, and optimize operations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="min-h-screen bg-background">
          {/* Server-rendered navigation */}
          <ServerNavigation />
          
          {/* Main content area */}
          <div className="md:ml-64">
            <main className="min-h-screen">
              <ClientProviders>
                {children}
              </ClientProviders>
            </main>
          </div>
        </div>
        
        {/* Global toast notifications */}
        <Toaster />
      </body>
    </html>
  );
}
```

**Create `src/app/client-providers.tsx`**:
```typescript
"use client";

import { TRPCReactProvider } from "~/trpc/react";
import { ThemeProvider } from "next-themes";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </TRPCReactProvider>
  );
}
```

### Step 5: Page-Level Auth Patterns

**Create `src/components/layout/AuthenticatedPage.tsx`**:
```typescript
import { redirect } from "next/navigation";
import { getServerAuth, requireServerAuth, requireServerOrgContext } from "~/lib/auth/server-context";

interface AuthenticatedPageProps {
  children: React.ReactNode;
  requireOrg?: boolean;
}

export async function AuthenticatedPage({ 
  children, 
  requireOrg = true 
}: AuthenticatedPageProps) {
  if (requireOrg) {
    await requireServerOrgContext();
  } else {
    await requireServerAuth();
  }

  return <>{children}</>;
}

// Usage in pages
export default async function DashboardPage() {
  return (
    <AuthenticatedPage>
      {/* Page content */}
    </AuthenticatedPage>
  );
}
```

### Step 6: Breadcrumb System

**Create `src/components/layout/ServerBreadcrumbs.tsx`**:
```typescript
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { Button } from "~/components/ui/button";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ServerBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function ServerBreadcrumbs({ items }: ServerBreadcrumbsProps) {
  const allItems = [
    { label: "Dashboard", href: "/dashboard" },
    ...items,
  ];

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground mb-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard" className="flex items-center">
          <Home className="h-4 w-4" />
        </Link>
      </Button>
      
      {allItems.slice(1).map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
          {item.href ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href={item.href}>
                {item.label}
              </Link>
            </Button>
          ) : (
            <span className="px-3 py-1 font-medium text-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}

// Usage in pages
export default async function IssueDetailPage({ params }: { params: { id: string } }) {
  const auth = await requireServerOrgContext();
  // Use React 19 cache() for data access
  const issue = await getIssueById(params.id, auth.organization.id);

  return (
    <div className="container mx-auto py-6">
      <ServerBreadcrumbs
        items={[
          { label: "Issues", href: "/issues" },
          { label: issue.title },
        ]}
      />
      {/* Page content */}
    </div>
  );
}
```

### Step 7: Loading and Error Boundaries

**Create `src/components/layout/NavigationSkeleton.tsx`**:
```typescript
import { Skeleton } from "~/components/ui/skeleton";
import { Separator } from "~/components/ui/separator";

export function NavigationSkeleton() {
  return (
    <div className="flex flex-col h-full">
      {/* Header skeleton */}
      <div className="p-4 border-b bg-muted/10">
        <Skeleton className="h-6 mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      
      <Separator />

      {/* Navigation skeleton */}
      <div className="flex-1 px-4 py-6 space-y-1">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>

      <Separator />
      
      {/* User menu skeleton */}
      <div className="p-4">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Create `src/app/error.tsx`**:
```typescript
"use client";

import { useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Card, CardContent } from "~/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="container mx-auto py-12">
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong!</AlertTitle>
            <AlertDescription className="mt-2">
              {error.message || "An unexpected error occurred"}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button onClick={reset} variant="outline">
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

### Step 8: Data Access Layer with React 19 cache()

**Create `src/lib/dal/auth-scoped-queries.ts`**:
```typescript
import { cache } from "react";
import { db } from "~/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { issues, machines, users } from "~/server/db/schema";

// React 19 cache() prevents duplicate queries within same request
export const getIssuesForOrg = cache(async (organizationId: string) => {
  console.log("🔍 Database query: Issues for org", organizationId);
  
  return await db.query.issues.findMany({
    where: eq(issues.organizationId, organizationId), // RLS also handles this automatically
    with: {
      machine: {
        columns: { id: true, name: true, model: true }
      },
      assignee: {
        columns: { id: true, name: true, email: true }
      }
    },
    orderBy: [desc(issues.createdAt)]
  });
});

export const getIssueById = cache(async (issueId: string, organizationId: string) => {
  console.log("🔍 Database query: Issue detail", issueId);
  
  const issue = await db.query.issues.findFirst({
    where: and(
      eq(issues.id, issueId),
      eq(issues.organizationId, organizationId) // Double security: explicit + RLS
    ),
    with: {
      machine: true,
      assignee: true,
      comments: {
        with: {
          author: {
            columns: { id: true, name: true, email: true }
          }
        }
      }
    }
  });
  
  if (!issue) throw new Error("Issue not found");
  return issue;
});

export const getMachinesForOrg = cache(async (organizationId: string) => {
  console.log("🔍 Database query: Machines for org", organizationId);
  
  return await db.query.machines.findMany({
    where: eq(machines.organizationId, organizationId),
    orderBy: [asc(machines.name)]
  });
});
```

### Step 9: Enhanced Server Actions (2025 Patterns)

**Create `src/lib/actions/issue-actions.ts`** (Updated for Supabase SSR):
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "~/utils/supabase/server"; // Uses createServerClient internally
import { db } from "~/server/db";
import { issues } from "~/server/db/schema";
import { requireServerOrgContext } from "~/lib/auth/server-context";

// React 19 enhanced Server Action with 2025 Supabase SSR patterns
export async function createIssueAction(formData: FormData) {
  // Server Actions use the same createClient utility as Server Components
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    redirect("/auth/sign-in");
  }

  const organizationId = user.user_metadata?.organizationId;
  if (!organizationId) {
    throw new Error("No organization selected");
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const machineId = formData.get("machineId") as string;
  const priority = formData.get("priority") as "low" | "medium" | "high";

  // Input validation
  if (!title || !machineId) {
    return { error: "Title and machine are required" };
  }

  try {
    const [newIssue] = await db.insert(issues).values({
      title,
      description,
      machineId,
      priority,
      organizationId: auth.organization.id,
      createdBy: auth.user.id
    }).returning();

    // Next.js 15: Explicit cache revalidation
    revalidatePath("/issues");
    revalidatePath(`/issues/${newIssue.id}`);
    
    return { success: true, issueId: newIssue.id };
  } catch (error) {
    console.error("Failed to create issue:", error);
    return { error: "Failed to create issue" };
  }
}

export async function updateIssueStatusAction(issueId: string, status: string) {
  const auth = await requireServerOrgContext();

  try {
    await db.update(issues)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(and(
        eq(issues.id, issueId),
        eq(issues.organizationId, auth.organization.id) // Security scoping
      ));

    revalidatePath("/issues");
    revalidatePath(`/issues/${issueId}`);
    
    return { success: true };
  } catch (error) {
    console.error("Failed to update issue status:", error);
    return { error: "Failed to update issue status" };
  }
}
```

### Step 10: Performance Optimizations

**Create `src/components/forms/CreateIssueForm.tsx`** (React 19 useActionState):
```typescript
"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { createIssueAction } from "~/lib/actions/issue-actions";
import { Alert, AlertDescription } from "~/components/ui/alert";

export function CreateIssueForm() {
  const [state, formAction, isPending] = useActionState(createIssueAction, null);
  
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Issue Title</Label>
        <Input 
          id="title"
          name="title" 
          placeholder="Describe the issue" 
          required
          aria-describedby={state?.error ? "form-error" : undefined}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea 
          id="description"
          name="description" 
          placeholder="Additional details..."
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <Select name="priority" defaultValue="medium">
          <SelectTrigger>
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {state?.error && (
        <Alert variant="destructive">
          <AlertDescription id="form-error">
            {state.error}
          </AlertDescription>
        </Alert>
      )}
      
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Creating..." : "Create Issue"}
      </Button>
      
      {state?.success && (
        <Alert>
          <AlertDescription>
            Issue created successfully!
          </AlertDescription>
        </Alert>
      )}
    </form>
  );
}
```

## 🎯 Success Criteria

**Phase 1D Complete When**:
1. ✅ Navigation renders on server with Supabase SSR auth context
2. ✅ Client islands handle interactions without hydration issues
3. ✅ Mobile navigation works with progressive enhancement via shadcn/ui Sheet
4. ✅ User menu and auth state work correctly with latest Supabase patterns
5. ✅ Page-level authentication redirects function with `requireServerOrgContext()`
6. ✅ Breadcrumbs generate server-side with shadcn/ui components
7. ✅ Loading states use shadcn/ui Skeleton components
8. ✅ Error boundaries provide good UX with shadcn/ui Alert components
9. ✅ React 19 cache() API eliminates duplicate database queries
10. ✅ Server Actions use latest validation and error handling patterns

**Performance Targets** (Updated for 2025 stack):
- Layout renders under 30ms server-side (React 19 + Next.js 15 optimizations)
- Client hydration under 150ms (reduced bundle via Server Components)
- Navigation interactions under 50ms (shadcn/ui performance)
- Database queries reduced by 80% via React 19 cache() API
- Bundle size reduced by 60% compared to MUI client-heavy approach
- First Contentful Paint under 800ms

## 🚨 Risk Mitigation

**High-Risk Areas** (Updated for 2025 stack):
- **Supabase SSR Implementation**: Critical cookie sync patterns - any deviation breaks auth entirely
- **Middleware Configuration**: Missing middleware or incorrect supabaseResponse handling causes session loss
- **Client/Server Boundaries**: Using wrong createClient (server vs browser) breaks auth flows  
- **OAuth Callback**: Missing callback route prevents OAuth sign-in completion
- **Code Placement**: Any code between createServerClient() and getUser() causes random logouts
- **Next.js 15 Caching**: Uncached `fetch()` calls causing performance issues
- **React 19 cache() API**: Potential memory leaks with improper cache boundaries
- **Drizzle + RLS**: Ensuring organizational scoping works correctly

**Mitigation Strategies** (Updated for 2025):
- **Follow Supabase SSR patterns exactly**: Any deviation from documented cookie handling breaks auth
- **Mandatory middleware setup**: Without proper middleware, sessions won't refresh properly  
- **Client utilities separation**: Use correct createClient utility for each context (server/client)
- **Never modify supabaseResponse**: Return middleware response object exactly as received
- **OAuth callback implementation**: Required for any OAuth-based authentication flows
- **Careful server/client boundaries**: Clear "use client" boundaries and proper component separation
- **React 19 cache() used only at request level**: Never across requests to prevent memory leaks
- **Double security**: RLS + explicit organizationId filtering in queries
- **Progressive enhancement**: All interactive elements work without JavaScript via shadcn/ui

**Testing Strategy** (Updated patterns):
- Server Component integration tests with React 19 cache() API
- Client island interaction tests with shadcn/ui components
- Supabase SSR auth flow testing across server/client boundary
- Performance testing for bundle size and database query reduction
- Next.js 15 caching behavior validation
- RLS policy testing via pgTAP

## 🎯 2025 Tech Stack Integration

**Critical Next.js 15 Considerations**:
- All `fetch()` calls must include explicit `cache: "force-cache"` for performance
- Use `revalidatePath()` and `revalidateTag()` for cache invalidation
- Implement React 19 `cache()` API for request-level memoization
- Enable React Compiler for automatic performance optimizations

**Supabase SSR Requirements** (2025 Critical Patterns):
- ⚠️ **MANDATORY**: Use `@supabase/ssr` package (NOT deprecated auth-helpers)
- ⚠️ **CRITICAL**: Implement `getAll()`/`setAll()` cookie handling pattern exactly as documented
- ⚠️ **NEVER MODIFY**: supabaseResponse object in middleware - return exactly as-is
- ⚠️ **DO NOT REMOVE**: `supabase.auth.getUser()` call in middleware
- ⚠️ **NO CODE**: Between `createServerClient()` and `getUser()` - causes random logouts
- ⚠️ **REQUIRED**: OAuth callback route at `app/auth/callback/route.ts`
- Use Server Actions for all authentication flows with proper SSR client creation

**shadcn/ui Best Practices**:
- Use 2025 Blocks system for complex UI patterns
- Leverage Universal Registry for custom components
- Apply Tailwind v4 CSS variable patterns
- Implement proper accessibility with Radix UI primitives

## ⏭️ Next Steps

Once Phase 1D is complete:
- **Phase 2**: Begin individual page and component migrations with latest patterns
- **Complete RSC foundation**: All Phase 1 components working together with 2025 stack
- **Performance baseline**: Measure improvements from server-first architecture
- **Tech Stack Validation**: Verify Next.js 15, React 19, and Supabase SSR integration

The layout system provides the foundation for the entire RSC migration by establishing proper server/client boundaries, modern auth patterns, and 2025 tech stack integration.