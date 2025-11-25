"use client";

import { useState } from "react";
import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordStrength } from "~/components/password-strength";
import { signupAction } from "~/app/(auth)/actions";

/**
 * Signup Form Client Component
 *
 * Wraps the signup form to add password strength indicator.
 * Handles submission client-side to preserve form state on error.
 */
export function SignupForm(): React.JSX.Element {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData): Promise<void> {
    setIsSubmitting(true);
    setError(null);

    const result = await signupAction(formData);

    if (result.ok) {
      router.push("/dashboard");
      return;
    }

    if (result.code === "CONFIRMATION_REQUIRED") {
      router.push("/login");
      return;
    }

    // If error, display it and keep form state
    // Note: The server action also sets a flash message, but we show the error inline here
    // for better UX without reload.
    let errorMessage = "Something went wrong";
    if (result.code === "VALIDATION") errorMessage = "Invalid input";
    if (result.code === "EMAIL_TAKEN") errorMessage = "Email already taken";
    if (result.message) errorMessage = result.message;

    setError(errorMessage);
    setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        void handleSubmit(formData);
      }}
      className="space-y-4"
    >
      {/* Error Message */}
      {error && (
        <div
          className="rounded-lg bg-error-container px-4 py-3 text-sm text-on-error-container"
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          type="text"
          placeholder="Your name"
          autoComplete="name"
          required
          maxLength={100}
          className="bg-surface-variant"
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="bg-surface-variant"
        />
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          className="bg-surface-variant"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-on-surface-variant">Minimum 8 characters</p>

        {/* Password strength indicator */}
        <PasswordStrength password={password} />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating Account..." : "Create Account"}
      </Button>
    </form>
  );
}
