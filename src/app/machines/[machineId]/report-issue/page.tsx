import { type Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreateIssueFormServer } from "~/components/forms/CreateIssueFormServer";
import { Button } from "~/components/ui/button";
import { createPublicIssueAction } from "~/lib/actions/issue-actions";
import { getPublicMachineById } from "~/lib/dal/public-machines";

export const dynamic = "force-dynamic"; // Always fetch fresh (public access)

interface ReportMachinePageProps {
  params: Promise<{ machineId: string }>;
}

export async function generateMetadata(
  props: ReportMachinePageProps,
): Promise<Metadata> {
  const { machineId } = await props.params;
  return {
    title: `Report Issue - ${machineId}`,
    description: "Report a problem with this machine",
  };
}

export default async function ReportMachinePage(
  props: ReportMachinePageProps,
): Promise<JSX.Element> {
  const { machineId } = await props.params;

  try {
    // Fetch machine + model + location for display (public context)
    const machineRecord = await getPublicMachineById(machineId);

    if (!machineRecord) {
      notFound();
    }

    const singleMachineList = [machineRecord];

    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">Report an Issue</h1>
          <p className="text-sm text-muted-foreground">
            You're reporting a problem with <strong>{machineRecord.name}</strong>.
          </p>
        </header>
        <CreateIssueFormServer
          machines={singleMachineList}
          action={createPublicIssueAction}
          initialMachineId={machineRecord.id}
          showMachineSelect={false}
          showPriority={false}
          showAssignee={false}
          showSeverity={true}
          showReporterFields={true}
        />
      </div>
    );
  } catch (error) {
    console.error("Failed to load machine for issue reporting:", error);

    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="text-center py-12 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Unable to Load Machine</h1>
            <p className="text-muted-foreground">
              We're having trouble loading this machine's information. Please
              try again in a moment.
            </p>
          </div>
          <Button asChild>
            <Link href="/">Return Home</Link>
          </Button>
        </div>
      </div>
    );
  }
}
