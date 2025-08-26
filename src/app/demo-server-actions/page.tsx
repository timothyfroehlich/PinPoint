import type { JSX } from "react";
import { CreateIssueForm } from "~/components/forms/CreateIssueForm";
import { getMachinesForOrg } from "~/lib/dal/machines";
import { getServerAuthContext } from "~/lib/dal/shared";

// Demo page to test Server Actions implementation
export default async function DemoServerActionsPage(): Promise<JSX.Element> {
  let machines: { id: string; name: string; model?: string }[] = [];
  let error: string | null = null;

  try {
    // Try to get authenticated context and machines
    await getServerAuthContext();
    machines = await getMachinesForOrg();
  } catch {
    // If not authenticated, show demo data
    error = "Demo mode - using sample data";
    machines = [
      { id: "demo-machine-1", name: "Medieval Madness", model: "Williams 1997" },
      { id: "demo-machine-2", name: "Attack from Mars", model: "Bally 1995" },
      { id: "demo-machine-3", name: "Twilight Zone", model: "Bally 1993" },
    ];
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Server Actions Demo</h1>
        <p className="text-muted-foreground">
          Testing React 19 useActionState with Next.js Server Actions
        </p>
        {error && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-700">{error}</p>
          </div>
        )}
      </div>

      <div className="grid gap-8 max-w-4xl">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Features Demonstrated</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✅ React 19 useActionState hook</li>
            <li>✅ Enhanced form validation with Zod</li>
            <li>✅ shadcn/ui components</li>
            <li>✅ React 19 cache() API for performance</li>
            <li>✅ Background processing simulation</li>
            <li>✅ Comprehensive error handling</li>
            <li>✅ TypeScript strict mode compatibility</li>
            <li>✅ React Compiler optimization enabled</li>
          </ul>
        </div>

        <CreateIssueForm 
          machines={machines} 
          className="max-w-lg"
        />
      </div>
    </div>
  );
}