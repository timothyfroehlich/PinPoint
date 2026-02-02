import type React from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { ClearReportDraft } from "./clear-draft";

export default async function ReportSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    new_pending?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const isNewPending = params.new_pending === "true";

  // Build signup URL with pre-filled name and email data
  const signupParams = new URLSearchParams();
  if (params.firstName) {
    signupParams.set("firstName", params.firstName);
  }
  if (params.lastName) {
    signupParams.set("lastName", params.lastName);
  }
  if (params.email) {
    signupParams.set("email", params.email);
  }
  const signupUrl =
    signupParams.toString() !== ""
      ? `/signup?${signupParams.toString()}`
      : "/signup";

  return (
    <main className="min-h-screen bg-surface py-12">
      <ClearReportDraft />
      <div className="container mx-auto max-w-xl px-4">
        <Card className="border-outline-variant bg-surface shadow-lg text-center p-6">
          <CardHeader className="space-y-3 pb-4">
            <CheckCircle
              className="mx-auto size-16 text-primary"
              strokeWidth={2.5}
            />
            <CardTitle className="text-3xl font-bold text-on-surface">
              Issue Sent!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <p className="text-lg text-on-surface">
                Thank you for reporting this issue.
              </p>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Our maintenance team has been notified. We appreciate your help
                keeping these machines running smoothly for everyone.
              </p>
            </div>

            {isNewPending && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-left">
                <h4 className="text-sm font-semibold text-primary mb-1">
                  Want to track your reports?
                </h4>
                <p className="text-xs text-on-surface-variant mb-3">
                  We&apos;ve saved your details. Create a full account to see
                  status updates and manage all your reports in one place.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="w-full bg-primary text-on-primary"
                >
                  <Link href={signupUrl}>Join PinPoint</Link>
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <Button
                asChild
                variant="outline"
                className="border-outline-variant text-on-surface"
              >
                <Link href="/report">Report Another Issue</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="text-on-surface hover:text-on-surface-variant"
              >
                <Link href="/">Return to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
