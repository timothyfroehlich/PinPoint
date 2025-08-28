import { type Metadata } from "next";
import Link from "next/link";
import { Home, Wrench } from "lucide-react";

import { CreateIssueFormServer } from "~/components/forms/CreateIssueFormServer";
import { requireServerAuth } from "~/lib/auth/server-auth";
import { createIssueAction } from "~/lib/actions/issue-actions";

// Temporary function - will be replaced with proper DAL function
async function getMachinesForCreateForm(organizationId: string) {
  // For now, return mock data to test the form structure
  return [
    { id: "mock-machine-1", name: "Medieval Madness", model: "Williams 1997" },
    { id: "mock-machine-2", name: "Attack from Mars", model: "Bally 1995" },
  ];
}

// Temporary function - will be replaced with proper DAL function  
async function getUsersForAssignment(organizationId: string) {
  // For now, return mock data to test the form structure
  return [
    { id: "test-user-tim", name: "Tim Froehlich", email: "tim@austinpinball.com" },
    { id: "test-user-tech1", name: "Tech User", email: "tech@austinpinball.com" },
  ];
}

// Force dynamic rendering for auth-dependent content
export const dynamic = "force-dynamic";

interface CreateIssuePageProps {
  searchParams: Promise<{
    machineId?: string;
  }>;
}

export const metadata: Metadata = {
  title: "Create Issue - PinPoint",
  description: "Report a new issue with a pinball machine",
  openGraph: {
    title: "Create Issue - PinPoint",
    description: "Report a new issue with a pinball machine",
    type: "website",
  },
};

export default async function CreateIssuePage({
  searchParams,
}: CreateIssuePageProps): Promise<React.JSX.Element> {
  const { organizationId } = await requireServerAuth();
  const resolvedSearchParams = await searchParams;

  // Parallel data fetching for form options
  const [machines, users] = await Promise.all([
    getMachinesForCreateForm(organizationId),
    getUsersForAssignment(organizationId),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-6">
        <Link href="/" className="flex items-center hover:text-foreground">
          <Home className="w-4 h-4 mr-1" />
          Home
        </Link>
        <span>/</span>
        <Link href="/issues" className="flex items-center hover:text-foreground">
          <Wrench className="w-4 h-4 mr-1" />
          Issues
        </Link>
        <span>/</span>
        <span className="text-foreground">Create</span>
      </nav>

      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Issue</h1>
        <p className="text-muted-foreground">
          Report a problem with a pinball machine to help keep the games running smoothly.
        </p>
      </div>

      {/* Server Component Form with Server Actions */}
      <CreateIssueFormServer 
        machines={machines}
        users={users}
        action={createIssueAction}
        {...(resolvedSearchParams.machineId && { initialMachineId: resolvedSearchParams.machineId })}
      />
    </div>
  );
}
