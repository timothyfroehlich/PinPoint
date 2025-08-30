/**
 * Auth Code Error Page - OAuth Callback Error Handling
 * Server Component for handling authentication failures
 */

import { Suspense } from "react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Alert } from "~/components/ui/alert";

interface AuthCodeErrorPageProps {
  searchParams: Promise<{
    error?: string;
    error_description?: string;
  }>;
}

export const metadata = {
  title: "Authentication Error - PinPoint",
  description: "Authentication error occurred",
};

export default async function AuthCodeErrorPage({
  searchParams,
}: AuthCodeErrorPageProps) {
  const resolvedSearchParams = await searchParams;
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-on-surface">
            Authentication Error
          </h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Something went wrong during the sign-in process
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-error">Sign-In Failed</CardTitle>
            <CardDescription>
              We encountered an error while trying to sign you in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense fallback={<ErrorDetailsSkeleton />}>
              <ErrorDetails
                error={resolvedSearchParams.error}
                description={resolvedSearchParams.error_description}
              />
            </Suspense>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/auth/sign-in">Try Again</Link>
              </Button>

              <Button asChild variant="outline" className="w-full">
                <Link href="/">Go Home</Link>
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Need help?{" "}
                <Link
                  href="/support"
                  className="font-medium text-primary hover:underline"
                >
                  Contact support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ErrorDetails({
  error,
  description,
}: {
  error?: string | undefined;
  description?: string | undefined;
}) {
  const getErrorMessage = (
    errorCode?: string,
  ): { title: string; message: string; suggestions: string[] } => {
    switch (errorCode) {
      case "oauth_failed":
        return {
          title: "OAuth Authentication Failed",
          message:
            "The authentication provider (Google) was unable to complete the sign-in process.",
          suggestions: [
            "Make sure you have a stable internet connection",
            "Try clearing your browser cache and cookies",
            "Ensure you're not blocking third-party cookies",
            "Try signing in with a different browser",
          ],
        };

      case "invalid_provider":
        return {
          title: "Invalid Authentication Provider",
          message:
            "The authentication provider you selected is not supported or configured incorrectly.",
          suggestions: [
            "Try using a different sign-in method",
            "Contact support if the problem persists",
          ],
        };

      case "no_redirect_url":
        return {
          title: "Configuration Error",
          message: "The authentication service didn't provide a redirect URL.",
          suggestions: [
            "This appears to be a configuration issue",
            "Please contact support for assistance",
          ],
        };

      case "unexpected":
      default:
        return {
          title: "Unexpected Error",
          message:
            description ||
            "An unexpected error occurred during the authentication process.",
          suggestions: [
            "Try signing in again",
            "Clear your browser cache and cookies",
            "Try using a different browser or device",
            "Contact support if the problem continues",
          ],
        };
    }
  };

  const errorInfo = getErrorMessage(error);

  return (
    <div className="space-y-4">
      <Alert className="border-error bg-error-container">
        <div className="text-on-error-container">
          <p className="font-medium">{errorInfo.title}</p>
          <p className="text-sm mt-1">{errorInfo.message}</p>
        </div>
      </Alert>

      <div className="space-y-2">
        <p className="text-sm font-medium text-on-surface">What you can try:</p>
        <ul className="text-sm text-on-surface-variant space-y-1">
          {errorInfo.suggestions.map((suggestion, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-outline mt-0.5">•</span>
              <span>{suggestion}</span>
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <details className="text-xs text-on-surface-variant">
          <summary className="cursor-pointer font-medium">
            Technical Details
          </summary>
          <div className="mt-2 space-y-1">
            <p>
              <strong>Error Code:</strong> {error}
            </p>
            {description && (
              <p>
                <strong>Description:</strong> {description}
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function ErrorDetailsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-20 bg-error-container border border-error rounded-md animate-pulse" />
      <div className="space-y-2">
        <div className="h-4 bg-surface-container rounded animate-pulse" />
        <div className="space-y-1">
          <div className="h-3 bg-surface-container-low rounded animate-pulse" />
          <div className="h-3 bg-surface-container-low rounded animate-pulse" />
          <div className="h-3 bg-surface-container-low rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
