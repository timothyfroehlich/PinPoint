# Phase 2E: Authenticated Dashboard

**Goal**: Create authenticated dashboard Server Component with issue list, user context, and organization statistics - completing the user's goal of logging in and seeing open issues

**Success Criteria**:
- Functional dashboard Server Component with authentication validation  
- Organization-scoped statistics and issue list integration
- User welcome and organization context display
- Navigation integration with authenticated user state
- Complete user journey: login → dashboard → issue management

---

## Core Dashboard Components

### Dashboard Server Component (`src/app/dashboard/page.tsx`)

**Purpose**: Main dashboard page combining authentication, statistics, and issue list

```tsx
import { Suspense } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { 
  IssuesIcon, 
  WrenchIcon, 
  TrendingUpIcon, 
  UserIcon,
  PlusIcon,
  ArrowRightIcon 
} from "lucide-react";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { getIssuesForOrg, getOrgStats } from "~/lib/dal/issues";
import { getOrganizationById } from "~/lib/dal/organizations";
import { IssuesListServer } from "~/components/issues/issues-list-server";
import { DashboardStats } from "~/components/dashboard/dashboard-stats";
import { QuickActions } from "~/components/dashboard/quick-actions";

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
  
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user.name}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-right">
            <Suspense fallback={<OrgNameSkeleton />}>
              <OrganizationName organizationId={organizationId} />
            </Suspense>
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.profile_picture} />
            <AvatarFallback>
              {user.name?.split(" ").map(n => n[0]).join("") || "?"}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
      
      {/* Organization Statistics */}
      <Suspense fallback={<StatsLoadingSkeleton />}>
        <DashboardStatsWithData organizationId={organizationId} />
      </Suspense>
      
      {/* Quick Actions */}
      <QuickActions />
      
      {/* Recent Issues */}
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Recent Issues</h2>
          <Button variant="outline" asChild>
            <Link href="/issues">
              View All Issues
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
        
        <Suspense fallback={<RecentIssuesLoadingSkeleton />}>
          <RecentIssuesWithData organizationId={organizationId} />
        </Suspense>
      </div>
    </div>
  );
}

// Server Component for organization name
async function OrganizationName({ organizationId }: { organizationId: string }) {
  const organization = await getOrganizationById(organizationId);
  return (
    <div className="text-sm text-muted-foreground">
      {organization.name}
    </div>
  );
}

// Server Component for dashboard statistics  
async function DashboardStatsWithData({ organizationId }: { organizationId: string }) {
  const stats = await getOrgStats(organizationId);
  return <DashboardStats stats={stats} />;
}

// Server Component for recent issues
async function RecentIssuesWithData({ organizationId }: { organizationId: string }) {
  const issues = await getIssuesForOrg(organizationId);
  const recentIssues = issues.slice(0, 5);
  
  if (recentIssues.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <IssuesIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">No issues yet</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Get started by creating your first issue report.
          </p>
          <Button asChild className="mt-4">
            <Link href="/issues/create">
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Issue
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <IssuesListServer issues={recentIssues} limit={5} />
      
      {issues.length > 5 && (
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing 5 of {issues.length} total issues
          </p>
        </div>
      )}
    </div>
  );
}

// Loading Skeletons
function OrgNameSkeleton() {
  return <div className="h-4 bg-muted rounded w-24 animate-pulse" />;
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="h-4 bg-muted rounded w-20 animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 bg-muted rounded w-12 animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentIssuesLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Dashboard Statistics Component (`src/components/dashboard/dashboard-stats.tsx`)

**Purpose**: Server Component for displaying organization statistics

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { 
  IssuesIcon, 
  WrenchIcon, 
  TrendingUpIcon, 
  AlertCircleIcon,
  CheckCircleIcon,
  ClockIcon 
} from "lucide-react";

interface DashboardStatsProps {
  stats: {
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    totalMachines: number;
  };
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const resolutionRate = stats.totalIssues > 0 
    ? Math.round((stats.closedIssues / stats.totalIssues) * 100)
    : 0;
    
  const inProgressIssues = stats.totalIssues - stats.openIssues - stats.closedIssues;
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Open Issues"
        value={stats.openIssues}
        icon={<AlertCircleIcon className="h-4 w-4" />}
        description="Requires attention"
        trend={stats.openIssues > 0 ? "needs-attention" : "good"}
      />
      
      <StatCard
        title="In Progress"
        value={inProgressIssues}
        icon={<ClockIcon className="h-4 w-4" />}
        description="Being worked on"
        trend="neutral"
      />
      
      <StatCard
        title="Resolution Rate"
        value={`${resolutionRate}%`}
        icon={<CheckCircleIcon className="h-4 w-4" />}
        description="Issues resolved"
        trend={resolutionRate >= 80 ? "good" : resolutionRate >= 60 ? "neutral" : "needs-attention"}
      />
      
      <StatCard
        title="Total Machines"
        value={stats.totalMachines}
        icon={<WrenchIcon className="h-4 w-4" />}
        description="In your inventory"
        trend="neutral"
      />
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  trend: "good" | "neutral" | "needs-attention";
}

function StatCard({ title, value, icon, description, trend }: StatCardProps) {
  const trendColors = {
    good: "text-green-600",
    neutral: "text-blue-600", 
    "needs-attention": "text-red-600"
  };
  
  const bgColors = {
    good: "bg-green-50",
    neutral: "bg-blue-50",
    "needs-attention": "bg-red-50"
  };
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-full ${bgColors[trend]}`}>
          <div className={trendColors[trend]}>
            {icon}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}
```

### Quick Actions Component (`src/components/dashboard/quick-actions.tsx`)

**Purpose**: Server Component with action buttons for common workflows

```tsx
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { 
  PlusIcon, 
  WrenchIcon, 
  QrCodeIcon, 
  SearchIcon,
  BarChart3Icon,
  SettingsIcon
} from "lucide-react";

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
            <Link href="/issues/create">
              <PlusIcon className="h-5 w-5" />
              <span className="text-xs">Create Issue</span>
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
            <Link href="/machines">
              <WrenchIcon className="h-5 w-5" />
              <span className="text-xs">View Machines</span>
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
            <Link href="/qr-codes">
              <QrCodeIcon className="h-5 w-5" />
              <span className="text-xs">QR Codes</span>
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
            <Link href="/issues?status=open">
              <SearchIcon className="h-5 w-5" />
              <span className="text-xs">Search Issues</span>
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
            <Link href="/analytics">
              <BarChart3Icon className="h-5 w-5" />
              <span className="text-xs">Analytics</span>
            </Link>
          </Button>
          
          <Button variant="outline" asChild className="h-auto p-4 flex-col gap-2">
            <Link href="/settings">
              <SettingsIcon className="h-5 w-5" />
              <span className="text-xs">Settings</span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Navigation with Authentication (`src/components/layout/navigation.tsx`)

**Purpose**: Server Component navigation with authenticated user context

```tsx
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { 
  HomeIcon, 
  IssuesIcon, 
  WrenchIcon, 
  BarChart3Icon,
  LogOutIcon
} from "lucide-react";
import type { ServerAuthContext } from "~/lib/auth/server-auth";
import { UserMenuClient } from "./user-menu-client";

interface NavigationProps {
  authContext: ServerAuthContext | null;
}

export function Navigation({ authContext }: NavigationProps) {
  if (!authContext) {
    // Unauthenticated navigation
    return (
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-xl font-bold">
              PinPoint
            </Link>
            
            <div className="flex items-center gap-4">
              <Button variant="ghost" asChild>
                <Link href="/auth/sign-in">Sign In</Link>
              </Button>
              <Button asChild>
                <Link href="/auth/sign-up">Sign Up</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
    );
  }
  
  // Authenticated navigation
  return (
    <nav className="border-b bg-white">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold">
              PinPoint
            </Link>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <HomeIcon className="h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
              
              <Button variant="ghost" size="sm" asChild>
                <Link href="/issues" className="flex items-center gap-2">
                  <IssuesIcon className="h-4 w-4" />
                  Issues
                </Link>
              </Button>
              
              <Button variant="ghost" size="sm" asChild>
                <Link href="/machines" className="flex items-center gap-2">
                  <WrenchIcon className="h-4 w-4" />
                  Machines
                </Link>
              </Button>
              
              <Button variant="ghost" size="sm" asChild>
                <Link href="/analytics" className="flex items-center gap-2">
                  <BarChart3Icon className="h-4 w-4" />
                  Analytics
                </Link>
              </Button>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{authContext.user.name}</p>
              <p className="text-xs text-muted-foreground">
                {authContext.user.email}
              </p>
            </div>
            
            <UserMenuClient user={authContext.user} />
          </div>
        </div>
      </div>
    </nav>
  );
}
```

### User Menu Client Island (`src/components/layout/user-menu-client.tsx`)

**Purpose**: Client Component for user menu dropdown

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { 
  UserIcon, 
  SettingsIcon, 
  LogOutIcon,
  ChevronDownIcon 
} from "lucide-react";

interface UserMenuClientProps {
  user: {
    id: string;
    name: string;
    email: string;
    profile_picture?: string;
  };
}

export function UserMenuClient({ user }: UserMenuClientProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.profile_picture} />
            <AvatarFallback>
              {user.name?.split(" ").map(n => n[0]).join("") || "?"}
            </AvatarFallback>
          </Avatar>
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/settings" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem asChild>
          <Link href="/auth/sign-out" className="flex items-center gap-2 text-red-600">
            <LogOutIcon className="h-4 w-4" />
            Sign Out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## Root Layout Integration

### Updated Root Layout (`src/app/layout.tsx`)

**Purpose**: Application shell with authentication-aware navigation

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getServerAuth } from "~/lib/auth/server-auth";
import { Navigation } from "~/components/layout/navigation";
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
        <div className="min-h-screen bg-background">
          <Navigation authContext={authContext} />
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
```

---

## Complete User Journey Implementation

### Home Page Redirect (`src/app/page.tsx`)

**Purpose**: Smart redirect based on authentication state

```tsx
import { redirect } from "next/navigation";
import { getServerAuth } from "~/lib/auth/server-auth";

export default async function HomePage() {
  const authContext = await getServerAuth();
  
  if (authContext) {
    // Authenticated user - redirect to dashboard
    redirect("/dashboard");
  } else {
    // Unauthenticated user - redirect to sign-in
    redirect("/auth/sign-in");
  }
}
```

### Development Authentication Route (`src/app/dev-auth/page.tsx`)

**Purpose**: Development-only authentication helper

```tsx
import { getDevAuthContext } from "~/lib/auth/server-auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default async function DevAuthPage() {
  if (process.env.NODE_ENV !== "development") {
    return <div>Development auth not available in production</div>;
  }
  
  const devAuth = await getDevAuthContext();
  
  return (
    <div className="max-w-md mx-auto mt-12">
      <Card>
        <CardHeader>
          <CardTitle>Development Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p><strong>User:</strong> {devAuth.user.name}</p>
            <p><strong>Email:</strong> {devAuth.user.email}</p>
            <p><strong>Organization:</strong> {devAuth.organizationId}</p>
          </div>
          
          <Button asChild className="w-full">
            <a href="/dashboard">
              Go to Dashboard
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Implementation Steps

### 1. Dashboard Server Component  
**Files**: `src/app/dashboard/page.tsx`
- [ ] Create authenticated dashboard with user welcome
- [ ] Integrate organization statistics display
- [ ] Add recent issues list with limit
- [ ] Implement proper Suspense boundaries and loading states
- [ ] Add metadata generation with org context

### 2. Dashboard Statistics Integration
**Files**: `src/components/dashboard/dashboard-stats.tsx`
- [ ] Create statistics cards with trend indicators  
- [ ] Implement responsive grid layout
- [ ] Add proper icon and color coding
- [ ] Calculate resolution rates and progress metrics

### 3. Navigation System Updates
**Files**: `src/components/layout/navigation.tsx`, user-menu components
- [ ] Create authentication-aware navigation
- [ ] Implement authenticated vs unauthenticated navigation states
- [ ] Add user menu dropdown as client island
- [ ] Include organization context display

### 4. Root Layout and Journey Integration  
**Files**: `src/app/layout.tsx`, `src/app/page.tsx`
- [ ] Update root layout with navigation integration
- [ ] Implement smart home page redirects
- [ ] Add development authentication helpers
- [ ] Ensure complete authentication flow works

---

## Architectural Alignment

### Complete Server-First Achievement
- ✅ **Dashboard Server Component**: No client-side data fetching required
- ✅ **Authentication Integration**: Server-side validation with automatic redirects
- ✅ **Organization Scoping**: All data properly scoped to user's organization
- ✅ **Progressive Enhancement**: Core functionality works without JavaScript
- ✅ **React 19 Patterns**: Using cache() API and Suspense for optimization

### User Experience Completion
- ✅ **Complete Journey**: Login → Dashboard → Issue Management
- ✅ **User Context**: Welcome message, avatar, organization display
- ✅ **Quick Actions**: Easy access to common workflows
- ✅ **Recent Issues**: Immediate visibility of open issues
- ✅ **Navigation**: Consistent authenticated experience

---

## Dependencies & Prerequisites

### Complete Before Starting
- [x] Phase 2A: Data Access Layer (all query functions operational)
- [x] Phase 2B: Server Actions (issue mutations working)
- [x] Phase 2C: Authentication (requireServerAuth, getServerAuth working)
- [x] Phase 2D: Issue Management (issue list Server Components)
- [x] All shadcn/ui components installed and working

### Required for Phase 2 Completion
- [ ] Dashboard renders with authentication validation
- [ ] Organization statistics display correctly
- [ ] Recent issues integration working
- [ ] Navigation shows authenticated user state
- [ ] Complete user journey functional

---

## Success Validation - USER GOAL ACHIEVEMENT

### Primary User Goal: "fully log in as a dev user and see a basic dashboard of open issues"
- [ ] ✅ **Login Works**: User can authenticate (dev auth or real Supabase)
- [ ] ✅ **Dashboard Loads**: `/dashboard` route renders with authentication
- [ ] ✅ **User Context**: Welcome message shows authenticated user name
- [ ] ✅ **Organization Context**: Dashboard shows organization information
- [ ] ✅ **Issue List**: Dashboard displays recent/open issues from database
- [ ] ✅ **Issue Details**: Can click through to individual issue details
- [ ] ✅ **Navigation**: Can navigate between dashboard, issues, and other sections

### Technical Validation
- [ ] All Server Components render without client-side data fetching
- [ ] React cache() prevents duplicate database queries
- [ ] Authentication context propagated through all components
- [ ] Organization scoping enforced on all data queries
- [ ] Supabase SSR integration working with middleware

### Performance Validation  
- [ ] Dashboard loads in under 2 seconds with typical data
- [ ] No hydration mismatches or client-side errors
- [ ] Minimal client-side JavaScript bundle
- [ ] Proper loading states during data fetching
- [ ] Mobile responsive design working

### Security Validation
- [ ] Unauthenticated users redirected to sign-in
- [ ] Organization data properly isolated
- [ ] Cross-organization access denied
- [ ] Authentication middleware working correctly
- [ ] Server Components enforce authentication

---

**Phase 2 Complete!** 🎉

**User Goal Achieved**: The user can now "fully log in as a dev user and see a basic dashboard of open issues"

**Next Steps**: Phase 3 will focus on advanced features, real-time functionality, and production optimization

**Architecture Transformation**: Successfully converted from client-heavy MUI architecture to server-first React Server Components with shadcn/ui, achieving the foundation for modern, performant, and maintainable application architecture.