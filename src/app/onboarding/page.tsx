import { redirect } from "next/navigation";

import { OnboardingForm } from "~/components/onboarding/OnboardingForm";
import { auth } from "~/server/auth";

export default async function OnboardingPage(): Promise<React.JSX.Element> {
  const session = await auth();

  // Redirect to sign-in if not authenticated
  if (!session?.user) {
    redirect("/sign-in");
  }

  // Redirect to dashboard if already onboarded
  if (session.user.onboardingCompleted) {
    redirect("/dashboard");
  }

  // Check if user was invited (has invitedBy field)
  const isInvited = Boolean(session.user.invitedBy);

  // Get organization name from session
  const organizationName = "Austin Pinball Collective"; // TODO: Get from session context

  return (
    <OnboardingForm organizationName={organizationName} isInvited={isInvited} />
  );
}
