import type { JSX } from "react";
import { getServerAuth } from "~/lib/auth/server-context";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Alert, AlertDescription } from "~/components/ui/alert";

export default async function Phase1DTestPage(): Promise<JSX.Element> {
  const auth = await getServerAuth();

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          Phase 1D Implementation Test
        </h1>
        <p className="text-muted-foreground">
          Testing server-first layout with 2025 Supabase SSR patterns
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Auth Status */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication Status</CardTitle>
          </CardHeader>
          <CardContent>
            {auth ? (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    ✅ Successfully authenticated via server-side auth context
                  </AlertDescription>
                </Alert>
                <div className="grid gap-2">
                  <div>
                    <strong>User ID:</strong> {auth.user.id}
                  </div>
                  <div>
                    <strong>Name:</strong> {auth.user.name}
                  </div>
                  <div>
                    <strong>Email:</strong> {auth.user.email}
                  </div>
                  {auth.organization && (
                    <>
                      <div>
                        <strong>Organization:</strong> {auth.organization.name}
                      </div>
                      <div>
                        <strong>Org ID:</strong> {auth.organization.id}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  ❌ Not authenticated - will redirect to sign-in via middleware
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Implementation Features */}
        <Card>
          <CardHeader>
            <CardTitle>Phase 1D Features Implemented</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div>✅ Supabase SSR client utilities (server & client)</div>
              <div>✅ 2025 SSR middleware with proper cookie handling</div>
              <div>✅ OAuth callback route for authentication flows</div>
              <div>✅ Server-side auth context with React 19 cache()</div>
              <div>✅ Server-rendered navigation with client islands</div>
              <div>✅ shadcn/ui components with MUI coexistence</div>
              <div>✅ Updated root layout with server-first architecture</div>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card>
          <CardHeader>
            <CardTitle>Ready for Phase 2</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div>Phase 1D foundation is complete and ready for:</div>
              <div>• Individual page conversions to Server Components</div>
              <div>
                • Data Access Layer implementation with direct DB queries
              </div>
              <div>• Server Actions for form handling and mutations</div>
              <div>
                • Progressive replacement of MUI components with shadcn/ui
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
