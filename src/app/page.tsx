import type { JSX } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { getServerAuthContext } from "~/lib/dal/shared";
import { getIssuesForOrg, getRecentIssues } from "~/lib/dal/issues";
import { getMachinesForOrg } from "~/lib/dal/machines";

// Simple authenticated dashboard component (Server Component)
async function AuthenticatedContent(): Promise<JSX.Element> {
  try {
    // Get organization data using DAL
    const [issues, recentIssues, machines] = await Promise.all([
      getIssuesForOrg(),
      getRecentIssues(5),
      getMachinesForOrg(),
    ]);

    const totalIssues = issues.length;
    const totalMachines = machines.length;
    
    // Calculate open vs resolved (simplified)
    const openIssues = issues.filter(issue => 
      issue.status_id && !issue.status_id.includes('resolved')
    ).length;

    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">My Dashboard</h1>
          <p className="text-muted-foreground">
            Here's what's happening with your issues and machines.
          </p>
        </div>

        {/* Simple stats grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{openIssues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalMachines}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentIssues.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Issues */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentIssues.length > 0 ? (
              recentIssues.map((issue) => (
                <div key={issue.id} className="flex items-center justify-between border-b pb-2">
                  <div className="flex-1">
                    <h3 className="font-medium">{issue.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {issue.machine ? issue.machine.name : 'Unknown Machine'}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No recent issues found.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch {
    // Not authenticated or no organization
    return (
      <div className="max-w-6xl mx-auto p-6 text-center">
        <Card>
          <CardContent className="p-8">
            <h2 className="text-xl font-semibold mb-4">Welcome to PinPoint</h2>
            <p className="text-muted-foreground mb-4">
              Sign in to access your dashboard and manage your pinball machines.
            </p>
            <Button>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}

// Simple public content (Server Component)
function PublicContent(): JSX.Element {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">PinPoint</h1>
          <p className="text-xl text-muted-foreground mb-2">
            Pinball Machine Issue Tracking System
          </p>
          <p className="text-muted-foreground">
            Track and manage issues with your pinball machines efficiently.
          </p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Welcome to PinPoint</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              Sign in to access your dashboard and manage your pinball machines, track issues, and optimize operations.
            </p>
            <Button asChild>
              <a href="/auth/sign-in">Get Started</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default async function HomePage(): Promise<JSX.Element> {
  // Check authentication status server-side
  const { user, organizationId } = await getServerAuthContext();

  return (
    <div>
      {/* Public content - always visible */}
      <PublicContent />
      
      {/* Authenticated content - only if user has organization */}
      {user && organizationId && <AuthenticatedContent />}
    </div>
  );
}
