/**
 * Modern Sign-Up Page - Server Component with OAuth & Email Registration
 * Implements Google OAuth and email registration using Server Actions
 */

import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignUpForm } from "./components/SignUpForm";
import { getRequestAuthContext } from "~/server/auth/context";

export const metadata = {
  title: "Sign Up - PinPoint",
  description: "Create your PinPoint account",
};

export default async function SignUpPage(): Promise<React.JSX.Element> {
  // Check if user is already authenticated
  const authContext = await getRequestAuthContext();
  if (authContext.kind === "authorized") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-on-surface">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Get started with PinPoint issue tracking
          </p>
        </div>

        <Suspense fallback={<SignUpFormSkeleton />}>
          <SignUpForm />
        </Suspense>
      </div>
    </div>
  );
}

function SignUpFormSkeleton(): React.JSX.Element {
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
