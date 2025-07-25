import { redirect } from "next/navigation";
import { Suspense } from "react";

import { IssueList } from "~/components/issues/IssueList";
import { auth } from "~/server/auth";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (!session?.user.id) {
    redirect("/");
  }

  // Await searchParams since it's a Promise in Next.js 15
  const params = await searchParams;

  // Parse search params for filters with TypeScript strictest compliance
  const locationId = params["locationId"];
  const machineId = params["machineId"];
  const statusId = params["statusId"];
  const statusCategory = params["statusCategory"];
  const sortBy = params["sortBy"];
  const sortOrder = params["sortOrder"];

  // Create filters object with proper TypeScript strictest compliance
  const filters: {
    locationId?: string | undefined;
    machineId?: string | undefined;
    statusId?: string | undefined;
    statusCategory?: "NEW" | "IN_PROGRESS" | "RESOLVED" | undefined;
    sortBy: "created" | "updated" | "status" | "severity" | "game";
    sortOrder: "asc" | "desc";
  } = {
    sortBy:
      typeof sortBy === "string" &&
      ["created", "updated", "status", "severity", "game"].includes(sortBy)
        ? (sortBy as "created" | "updated" | "status" | "severity" | "game")
        : "created",
    sortOrder:
      typeof sortOrder === "string" && ["asc", "desc"].includes(sortOrder)
        ? (sortOrder as "asc" | "desc")
        : "desc",
  };

  // Conditionally add optional properties
  if (typeof locationId === "string") {
    filters.locationId = locationId;
  }
  if (typeof machineId === "string") {
    filters.machineId = machineId;
  }
  if (typeof statusId === "string") {
    filters.statusId = statusId;
  }
  if (
    typeof statusCategory === "string" &&
    ["NEW", "IN_PROGRESS", "RESOLVED"].includes(statusCategory)
  ) {
    filters.statusCategory = statusCategory as
      | "NEW"
      | "IN_PROGRESS"
      | "RESOLVED";
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Issues</h1>
        <p className="text-gray-600 mt-2">
          Track and manage all issues across your pinball machines
        </p>
      </div>

      <Suspense fallback={<div>Loading issues...</div>}>
        <IssueList initialFilters={filters} />
      </Suspense>
    </div>
  );
}
