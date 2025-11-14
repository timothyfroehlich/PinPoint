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
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    if (
      !emailInput ||
      !passwordInput ||
      !(emailInput instanceof HTMLInputElement) ||
      !(passwordInput instanceof HTMLInputElement)
    ) {
      // Form fields not found or not the right type
      return;
    }

    const form = emailInput.closest("form");
    if (!form) {
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
