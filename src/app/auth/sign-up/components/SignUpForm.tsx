/**
 * Sign-Up Form Component - Client Island for Registration
 * Modern form with Google OAuth and email registration using React 19 patterns
 */

"use client";

import { useActionState } from "react";
import { useState, useEffect } from "react";
import { z } from "zod";

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
  signInWithOAuth,
  sendMagicLink,
  type ActionResult,
} from "~/lib/actions/auth-actions";
import { type OrganizationOption } from "~/lib/dal/public-organizations";

// API Response validation schema for security
const organizationSelectOptionsSchema = z.object({
  organizations: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      subdomain: z.string().min(1),
    }),
  ),
  defaultOrganizationId: z.string().nullable(),
});

// Type guard for safe organization access
function isValidOrganizationArray(data: unknown): data is OrganizationOption[] {
  return (
    Array.isArray(data) &&
    data.every((item): item is OrganizationOption => {
      if (typeof item !== "object" || item === null) return false;

      const obj = item as Record<string, unknown>;
      return (
        "id" in obj &&
        "name" in obj &&
        "subdomain" in obj &&
        typeof obj.id === "string" &&
        typeof obj.name === "string" &&
        typeof obj.subdomain === "string"
      );
    })
  );
}

export function SignUpForm(): JSX.Element {
  const [magicLinkState, magicLinkAction, magicLinkPending] = useActionState<
    ActionResult<{ message: string }> | null,
    FormData
  >(sendMagicLink, null);

  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  // Organization selection state
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] =
    useState<string>("");
  const [organizationsLoading, setOrganizationsLoading] = useState(true);

  // Load organizations on component mount
  useEffect(() => {
    async function loadOrganizations(): Promise<void> {
      try {
        const response = await fetch("/api/organizations/public");
        if (!response.ok) {
          throw new Error("Failed to fetch organizations");
        }

        // Security: Validate API response to prevent injection attacks
        const rawData: unknown = await response.json();
        const validatedData = organizationSelectOptionsSchema.parse(rawData);

        const { organizations: orgs, defaultOrganizationId } = validatedData;

        // Additional defensive validation
        if (!isValidOrganizationArray(orgs)) {
          throw new Error("Invalid organization data structure");
        }

        setOrganizations(orgs);
        setSelectedOrganizationId(defaultOrganizationId ?? orgs[0]?.id ?? "");
      } catch (error) {
        console.error("Failed to load organizations:", error);
        // Handle validation errors gracefully
        if (error instanceof z.ZodError) {
          console.error("API response validation failed:", error.issues);
        }
      } finally {
        setOrganizationsLoading(false);
      }
    }

    void loadOrganizations();
  }, []);

  const handleOAuthSignUp = async (provider: "google"): Promise<void> => {
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Choose how you'd like to create your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Selector */}
        <div className="space-y-2">
          <Label htmlFor="organization">Organization</Label>
          {organizationsLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              <span className="text-sm text-muted-foreground">
                Loading organizations...
              </span>
            </div>
          ) : (
            <Select
              value={selectedOrganizationId}
              onValueChange={setSelectedOrganizationId}
              disabled={isOAuthLoading || magicLinkPending}
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
          onClick={() => void handleOAuthSignUp("google")}
          disabled={isOAuthLoading || magicLinkPending}
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
              Sign up with Google
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

        {/* Email Registration Form */}
        <form action={magicLinkAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              required
              disabled={magicLinkPending || isOAuthLoading}
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
            disabled={magicLinkPending || isOAuthLoading}
            className="w-full"
          >
            {magicLinkPending ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                Creating account...
              </div>
            ) : (
              "Create account with email"
            )}
          </Button>
        </form>

        {/* Action Results */}
        {magicLinkState?.success === true && (
          <Alert className="border-tertiary bg-tertiary-container">
            <div className="text-on-tertiary-container">
              <p className="font-medium">Account creation initiated!</p>
              <p className="text-sm mt-1">{magicLinkState.data.message}</p>
            </div>
          </Alert>
        )}

        {magicLinkState?.success === false && !magicLinkState.fieldErrors && (
          <Alert className="border-error bg-error-container">
            <div className="text-on-error-container">
              <p className="font-medium">Account creation failed</p>
              <p className="text-sm mt-1">{magicLinkState.error}</p>
            </div>
          </Alert>
        )}

        <div className="text-xs text-center text-muted-foreground space-y-2">
          <p>
            By creating an account, you agree to our{" "}
            <a
              href="/terms"
              className="font-medium text-primary hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="font-medium text-primary hover:underline"
            >
              Privacy Policy
            </a>
          </p>

          <p>
            Already have an account?{" "}
            <a
              href="/auth/sign-in"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
