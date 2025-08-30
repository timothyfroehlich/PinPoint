import { type Metadata } from "next";
import Link from "next/link";
import { Home, Wrench } from "lucide-react";

import { CreateIssueFormServer } from "~/components/forms/CreateIssueFormServer";
import { requireMemberAccess } from "~/lib/organization-context";
import { createIssueAction } from "~/lib/actions/issue-actions";
import { getMachinesForOrg } from "~/lib/dal/machines";
import { getAssignableUsers } from "~/lib/dal/users";

// Transform DAL data for CreateIssueFormServer component
function transformMachinesForForm(machinesResult: Awaited<ReturnType<typeof getMachinesForOrg>>) {
  return machinesResult.items.map(machine => ({
    id: machine.id,
    name: machine.name,
    ...(machine.model?.name && { model: machine.model.name }),
  }));
}

// Transform DAL data for CreateIssueFormServer component
function transformUsersForForm(assignableUsers: Awaited<ReturnType<typeof getAssignableUsers>>) {
  return assignableUsers
    .map(user => ({
      id: user.id,
      name: user.name || 'Unknown User',
      email: user.email || '',
    }))
    .filter(user => user.email); // Filter out users without email
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
  await requireMemberAccess(); // Ensure authenticated user with organization membership
  const resolvedSearchParams = await searchParams;

  // Parallel data fetching using real DAL functions with React 19 cache()
  const [machinesRaw, assignableUsersRaw] = await Promise.all([
    getMachinesForOrg(),
    getAssignableUsers(),
  ]);

  // Transform data to match component expectations
  const machines = transformMachinesForForm(machinesRaw);
  const users = transformUsersForForm(assignableUsersRaw);

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
