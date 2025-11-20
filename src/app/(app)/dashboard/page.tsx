import type React from "react";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { logoutAction } from "~/app/(auth)/actions";
import { readFlash } from "~/lib/flash";
import { UserCircle, Mail } from "lucide-react";

/**
 * Dashboard Page (Protected Route)
 *
 * Example of a protected route that requires authentication.
 * Redirects to /login if user is not authenticated.
 *
 * This demonstrates the auth guard pattern for Server Components.
 */
export default async function DashboardPage(): Promise<React.JSX.Element> {
  // Auth guard - check if user is authenticated (CORE-SSR-002)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Read flash message (if any)
  const flash = await readFlash();

  // Get user metadata
  const name = user.user_metadata["name"] as string | undefined;
  const email = user.email;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader className="space-y-3">
          <CardTitle className="text-3xl font-bold text-foreground">
            Dashboard
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Welcome to your PinPoint dashboard
          </p>
        </CardHeader>

        <CardContent className="space-y-6" data-testid="dashboard-content">
          {/* Flash message */}
          {flash && (
            <div
              className={`rounded-lg px-4 py-3 text-sm ${
                flash.type === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-accent text-accent-foreground"
              }`}
              role="alert"
            >
              {flash.message}
            </div>
          )}

          {/* User info */}
          <div className="space-y-4">
            <h2
              className="text-lg font-semibold text-foreground"
              data-testid="dashboard-welcome"
            >
              Your Profile
            </h2>

            <div className="space-y-3 bg-muted/50 rounded-lg p-4">
              {/* Name */}
              {name && (
                <div className="flex items-center gap-3">
                  <UserCircle className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p
                      className="text-sm font-medium text-foreground"
                      data-testid="dashboard-user-name"
                    >
                      {name}
                    </p>
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="flex items-center gap-3">
                <Mail className="size-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p
                    className="text-sm font-medium text-foreground"
                    data-testid="dashboard-user-email"
                  >
                    {email}
                  </p>
                </div>
              </div>

              {/* User ID (for debugging) */}
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground">User ID</p>
                <p className="text-xs font-mono text-muted-foreground">
                  {user.id}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              Quick Actions
            </h2>

            <div className="flex flex-col gap-2">
              {/* Logout button */}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>

          {/* Info box */}
          <div className="border-t border-border pt-6">
            <p className="text-sm text-muted-foreground text-center">
              This is a protected route. Only authenticated users can access
              this page.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
