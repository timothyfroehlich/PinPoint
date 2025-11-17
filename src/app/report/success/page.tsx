import type React from "react";
import Link from "next/link";
import { CheckCircle, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Navigation } from "~/components/layout/navigation";

/**
 * Public Report Success Page
 *
 * Confirmation page after successful anonymous issue report.
 */
export default function PublicReportSuccessPage(): React.JSX.Element {
  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-surface py-8">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-outline-variant bg-surface shadow-xl">
            <CardHeader className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle
                  className="size-8 text-green-600"
                  strokeWidth={2.5}
                />
                <CardTitle className="text-3xl font-bold text-on-surface">
                  Thank You for Reporting This Issue!
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="text-base text-on-surface">
                Your issue report has been successfully submitted. Our team has
                been notified and will address it as soon as possible.
              </p>

              <p className="text-sm text-on-surface-variant">
                We appreciate you taking the time to help us keep our pinball
                machines running smoothly for everyone to enjoy!
              </p>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row">
                <Button
                  asChild
                  className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
                >
                  <Link href="/report" className="flex items-center gap-2">
                    <Plus className="size-4" />
                    Report Another Issue
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="flex-1 border-outline-variant text-on-surface"
                >
                  <Link href="/">Return Home</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
