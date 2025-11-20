import type React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { createMachineAction } from "~/app/(app)/machines/actions";
import { readFlash } from "~/lib/flash";

/**
 * Create Machine Page (Protected Route)
 *
 * Form to create a new pinball machine.
 * Uses Server Actions with progressive enhancement (works without JS).
 */
export default async function NewMachinePage(): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read flash message (for form errors)
  const flash = await readFlash();

  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-muted/40">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/machines">
              <Button
                variant="outline"
                size="sm"
                className="border-input text-foreground hover:bg-accent"
              >
                <ArrowLeft className="mr-2 size-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Add New Machine
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a new pinball machine entry
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl text-foreground">
              Machine Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Flash message */}
            {flash && (
              <div
                className={`mb-6 rounded-md border p-4 ${
                  flash.type === "error"
                    ? "border-error bg-error/10 text-error"
                    : "border-primary bg-primary/10 text-primary"
                }`}
              >
                <p className="text-sm font-medium">{flash.message}</p>
              </div>
            )}

            <form action={createMachineAction} className="space-y-6">
              {/* Machine Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">
                  Machine Name *
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g., Medieval Madness"
                  className="border-input bg-background text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Enter the full name of the pinball machine
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-primary text-on-primary hover:bg-primary/90"
                >
                  Create Machine
                </Button>
                <Link href="/machines" className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-input text-foreground hover:bg-accent"
                  >
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
