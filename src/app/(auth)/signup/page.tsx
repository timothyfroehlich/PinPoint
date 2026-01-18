import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { createClient } from "~/lib/supabase/server";
import { SignupForm } from "./signup-form";

import { db } from "~/server/db";
import { invitedUsers } from "~/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * Signup Page
 *
 * User registration with email, password, and name.
 * Progressive enhancement - works without JavaScript.
 * Password strength indicator (client-side enhancement).
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    firstName?: string;
    lastName?: string;
  }>;
}): Promise<React.JSX.Element> {
  // Check if already logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { email, firstName, lastName } = await searchParams;
  let initialData = undefined;

  if (email) {
    const invited = await db.query.invitedUsers.findFirst({
      where: eq(invitedUsers.email, email),
    });

    if (invited) {
      initialData = {
        email: invited.email,
        firstName: invited.firstName,
        lastName: invited.lastName,
      };
    } else {
      // If email is provided but no invited user found, we still pre-fill the email
      // Also include firstName and lastName from query params if provided
      initialData = {
        email,
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
      };
    }
  } else if (firstName || lastName) {
    // No email but name provided (e.g., from report success page)
    initialData = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
    };
  }

  return (
    <Card className="border-outline-variant bg-surface shadow-xl">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-on-surface">
          Create Account
        </CardTitle>
        <p className="text-sm text-on-surface-variant">
          Join PinPoint to report and track issues
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Signup form - Client Component for password strength */}
        <SignupForm initialData={initialData} />

        {/* Login link */}
        <div className="text-center text-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link href="/login" className="text-link font-medium">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
