"use client";

import type React from "react";
import { Button } from "~/components/ui/button";

/**
 * Test Admin Login Button
 *
 * Development-only button that automatically fills login form
 * with test admin credentials and submits it.
 */
export function TestAdminButton(): React.JSX.Element {
  function handleTestAdminLogin(): void {
    // Find the form fields
    const emailInput = document.getElementById("email") as HTMLInputElement;
    const passwordInput = document.getElementById(
      "password",
    ) as HTMLInputElement;
    const form = emailInput?.closest("form");

    if (!emailInput || !passwordInput || !form) {
      console.error("Could not find login form fields");
      return;
    }

    // Fill in test admin credentials
    emailInput.value = "admin@test.com";
    passwordInput.value = "TestPassword123";

    // Submit the form
    form.requestSubmit();
  }

  return (
    <Button
      type="button"
      onClick={handleTestAdminLogin}
      variant="outline"
      className="w-full"
      size="lg"
    >
      🔧 Login as Test Admin
    </Button>
  );
}
