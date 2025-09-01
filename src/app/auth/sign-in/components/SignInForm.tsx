/**
 * Sign-In Form Component - Client Island for Authentication
 * Modern form with Google OAuth and Magic Link using React 19 patterns
 */

"use client";

import { useActionState } from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Alert } from "~/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  sendMagicLink,
  signInWithOAuth,
  type ActionResult,
} from "~/lib/actions/auth-actions";
import { type OrganizationOption } from "~/lib/dal/public-organizations";

// Development auth integration
import { authenticateDevUser, getAuthResultMessage } from "~/lib/auth/dev-auth";
import { isDevAuthAvailable } from "~/lib/environment-client";
import { createClient } from "~/utils/supabase/client";
import { getCurrentDomain } from "~/lib/utils/domain";

export function SignInForm() {
  const router = useRouter();
  
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState<
    ActionResult<{ message: string }> | null,
    FormData
  >(sendMagicLink, null);

  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [devAuthLoading, setDevAuthLoading] = useState(false);
  const [devAuthError, setDevAuthError] = useState<string | null>(null);

  // Organization selection state
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string>("");
  const [organizationsLoading, setOrganizationsLoading] = useState(true);

  // tRPC: fetch public organizations (anon-safe)
  const { data: publicOrganizations, isLoading: orgsLoading } =
    api.organization.listPublic.useQuery();

  // Development auth integration (preserving existing dev auth system)
  const shouldShowDevLogin = isDevAuthAvailable();

  // Load organizations from tRPC when ready
  useEffect(() => {
    setOrganizationsLoading(orgsLoading);
    if (orgsLoading) return;

    const orgs: OrganizationOption[] = (publicOrganizations ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      subdomain: o.subdomain,
    }));

    // Prefer APC/test org as default if present, else first
    const apc = orgs.find(
      (o) => o.subdomain === "apc" || o.id === "test-org-pinpoint",
    );
    const defaultId = apc?.id ?? orgs[0]?.id ?? "";

    setOrganizations(orgs);
    setSelectedOrganizationId(defaultId);
  }, [publicOrganizations, orgsLoading]);

  const handleOAuthSignIn = async (provider: "google") => {
    if (!selectedOrganizationId) {
      alert("Please select an organization");
      return;
    }
    
    setIsOAuthLoading(true);
    try {
      await signInWithOAuth(provider, selectedOrganizationId);
    } catch (error) {
      console.error("OAuth error:", error);
      setIsOAuthLoading(false);
    }
  };

  const handleDevAuth = async (email: string, role: string) => {
    if (!selectedOrganizationId) {
      alert("Please select an organization");
      return;
    }
    
    setDevAuthLoading(true);
    try {
      const supabase = createClient();
      const userData = {
        email,
        name: email.split("@").at(0) ?? "user",
        role,
        organizationId: selectedOrganizationId,
      };
      const result = await authenticateDevUser(supabase, userData);

      if (result.success) {
        console.log("Dev login successful:", result.method);
        
        // CRITICAL: Wait for session to sync between client and server
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Use the selected organization from the dropdown to redirect to proper subdomain
        const selectedOrg = organizations.find(org => org.id === selectedOrganizationId);
        if (selectedOrg?.subdomain) {
          const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
          if (isDev) {
            window.location.href = `https://${selectedOrg.subdomain}.localhost:3000/dashboard`;
            return;
          }
          // In production, use dynamic domain
          const currentDomain = getCurrentDomain();
          window.location.href = `https://${selectedOrg.subdomain}.${currentDomain}/dashboard`;
          return;
        }
        
        // Fallback: regular navigation if no organization selected
        router.refresh();
        await new Promise(resolve => setTimeout(resolve, 200));
        router.push('/dashboard');
      } else {
        console.error("Login failed:", result.error);
        setDevAuthError(getAuthResultMessage(result));
      }
    } catch (error) {
      console.error("Dev auth error:", error);
      setDevAuthError("Dev authentication failed");
    } finally {
      setDevAuthLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Choose your preferred sign-in method</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Selector */}
        <div className="space-y-2">
          <Label htmlFor="organization">Organization</Label>
          {organizationsLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              <span className="text-sm text-muted-foreground">Loading organizations...</span>
            </div>
          ) : (
            <Select
              value={selectedOrganizationId}
              onValueChange={setSelectedOrganizationId}
              disabled={isOAuthLoading || magicLinkPending || devAuthLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select your organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {organizations.length === 0 && !organizationsLoading && (
            <p className="text-sm text-error">
              No organizations available. Please contact support.
            </p>
          )}
        </div>

        <Separator />

        {/* Google OAuth */}
        <Button
          onClick={() => void handleOAuthSignIn("google")}
          disabled={isOAuthLoading || magicLinkPending || devAuthLoading}
          className="w-full"
          variant="outline"
        >
          {isOAuthLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              Connecting to Google...
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </div>
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-surface px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        {/* Magic Link Form */}
        <form action={magicLinkAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={magicLinkPending || isOAuthLoading || devAuthLoading}
            />
            {magicLinkState?.success === false &&
              magicLinkState.fieldErrors?.["email"] && (
                <p className="text-sm text-error">
                  {magicLinkState.fieldErrors["email"]}
                </p>
              )}
          </div>

          {/* Hidden organization ID field */}
          <input
            type="hidden"
            name="organizationId"
            value={selectedOrganizationId}
          />

          <Button
            type="submit"
            disabled={magicLinkPending || isOAuthLoading || devAuthLoading}
            className="w-full"
          >
            {magicLinkPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                Sending magic link...
              </div>
            ) : (
              "Send magic link"
            )}
          </Button>
        </form>

        {/* Action Results */}
        {magicLinkState?.success === true && (
          <Alert className="border-tertiary bg-tertiary-container">
            <div className="text-on-tertiary-container">
              <p className="font-medium">Magic link sent!</p>
              <p className="text-sm mt-1">{magicLinkState.data.message}</p>
            </div>
          </Alert>
        )}

        {magicLinkState?.success === false && !magicLinkState.fieldErrors && (
          <Alert className="border-error bg-error-container">
            <div className="text-on-error-container">
              <p className="font-medium">Sign-in failed</p>
              <p className="text-sm mt-1">{magicLinkState.error}</p>
            </div>
          </Alert>
        )}

        {/* Development Auth (preserved from existing system) */}
        {shouldShowDevLogin && (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">
                  Development Mode
                </p>
                <p className="text-xs text-muted-foreground">
                  Quick login for testing
                </p>
              </div>

              {devAuthError && (
                <Alert className="border-destructive">
                  <p className="text-sm text-destructive">{devAuthError}</p>
                </Alert>
              )}

              <div className="space-y-2">
                <Button
                  onClick={() =>
                    void handleDevAuth("tim.froehlich@example.com", "Admin")
                  }
                  disabled={
                    devAuthLoading || magicLinkPending || isOAuthLoading
                  }
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  {devAuthLoading ? "Logging in..." : "Dev Login: Tim (Admin)"}
                </Button>

                <Button
                  onClick={() =>
                    void handleDevAuth("harry.williams@example.com", "Member")
                  }
                  disabled={
                    devAuthLoading || magicLinkPending || isOAuthLoading
                  }
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                >
                  {devAuthLoading
                    ? "Logging in..."
                    : "Dev Login: Harry (Member)"}
                </Button>
              </div>
            </div>
          </>
        )}

        <div className="text-center text-sm text-muted-foreground">
          <p>
            Don't have an account?{" "}
            <a
              href="/auth/sign-up"
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
