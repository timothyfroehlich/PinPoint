import type React from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export default function ReportSuccessPage(): React.JSX.Element {
  return (
    <main className="min-h-screen bg-background py-12">
      <div className="container mx-auto max-w-xl px-4">
        <Card className="shadow-lg text-center space-y-0">
          <CardHeader className="space-y-3">
<<<<<<< HEAD
            <CheckCircle className="mx-auto size-10 text-primary" />
            <CardTitle className="text-3xl text-foreground">
=======
            <CheckCircle className="mx-auto size-12 text-primary" />
            <CardTitle className="text-3xl text-on-surface">
>>>>>>> origin/main
              Thank You for Reporting This Issue!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Our team has been notified and will address it soon. We appreciate
              your help keeping the games running smoothly.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild className="bg-primary text-on-primary">
                <Link href="/report">Report Another Issue</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="text-foreground hover:bg-accent"
              >
                <Link href="/">Return Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
