/**
 * Modern Sign-In Page - Server Component with OAuth & Magic Link
 * Implements Google OAuth and Magic Link authentication using Server Actions
 */

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "./components/SignInForm";
import { getOrganizationContext } from "~/lib/organization-context";

export const metadata = {
  title: "Sign In - PinPoint",
  description: "Sign in to your PinPoint account",
};

export default async function SignInPage(): Promise<React.JSX.Element> {
  // Check if user is already authenticated
  const orgContext = await getOrganizationContext();
  if (orgContext?.user && orgContext.accessLevel === "member") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-on-surface">Welcome back</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Sign in to your PinPoint account to continue
          </p>
        </div>

        <Suspense fallback={<SignInFormSkeleton />}>
          <SignInForm />
        </Suspense>
      </div>
    </div>
  );
}

function SignInFormSkeleton(): React.JSX.Element {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="h-12 bg-surface-container rounded-md animate-pulse" />
        <div className="h-12 bg-surface-container rounded-md animate-pulse" />
        <div className="h-12 bg-surface-container rounded-md animate-pulse" />
      </div>
    </div>
  );
}
