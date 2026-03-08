import type React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { Forbidden } from "~/components/errors/Forbidden";

export const metadata = {
  title: "Admin Help | PinPoint",
};

export default async function AdminHelpPage(): Promise<React.JSX.Element> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });

  if (profile?.role !== "admin") {
    return <Forbidden role={profile?.role ?? null} />;
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <header className="space-y-2 mb-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Link href="/help" className="text-primary underline">
            Help
          </Link>
          <span>/</span>
          <span>Admin</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Help</h1>
        <p className="text-sm text-muted-foreground">
          Administrative procedures for managing PinPoint.
        </p>
      </header>

      <section className="space-y-3 mb-8">
        <h2 className="text-lg font-semibold">Username-Only Accounts</h2>
        <p className="text-sm text-muted-foreground">
          Some users prefer not to share their email address. PinPoint supports
          admin-created &ldquo;username accounts&rdquo; that use a username and
          password instead of an email.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h3 className="text-base font-semibold">Creating a Username Account</h3>
        <p className="text-sm text-muted-foreground">
          Run the following script from the project root (requires access to the
          server environment):
        </p>
        <pre className="bg-muted rounded-md p-4 text-sm overflow-x-auto">
          {`./scripts/admin-username-account.mjs \\
  --username jdoe \\
  --first "John" --last "Doe" \\
  --role member`}
        </pre>
        <p className="text-sm text-muted-foreground">
          The script generates a random password and prints it. Give the
          username and password to the user (verbally or on paper). They log in
          by typing their username in the Email field on the login page.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h3 className="text-base font-semibold">Resetting a Password</h3>
        <p className="text-sm text-muted-foreground">
          Username account users cannot use &ldquo;Forgot Password&rdquo; since
          they have no email. To reset their password:
        </p>
        <pre className="bg-muted rounded-md p-4 text-sm overflow-x-auto">
          {`./scripts/admin-username-account.mjs \\
  --reset-password --username jdoe`}
        </pre>
        <p className="text-sm text-muted-foreground">
          Give the new password to the user. They can change it in Settings
          after logging in.
        </p>
      </section>

      <section className="space-y-3 mb-8">
        <h3 className="text-base font-semibold">Limitations</h3>
        <ul className="space-y-2 text-sm text-muted-foreground list-disc list-inside">
          <li>
            <strong>No email notifications</strong> — username accounts will
            never receive email notifications. In-app notifications still work.
          </li>
          <li>
            <strong>No self-service password reset</strong> — the user must
            contact an admin to reset their password.
          </li>
          <li>
            <strong>No invite flow</strong> — the account is created directly
            via the script, not through the invite system.
          </li>
        </ul>
      </section>
    </div>
  );
}
