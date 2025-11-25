"use client";

import { useState } from "react";
import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { forgotPasswordAction } from "~/app/(auth)/actions";

export function ForgotPasswordForm(): React.JSX.Element {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  async function handleSubmit(formData: FormData): Promise<void> {
    setIsSubmitting(true);
    setMessage(null);

    const result = await forgotPasswordAction(formData);

    if (result.ok) {
      setMessage({
        type: "success",
        text: "If an account exists with that email, you will receive a password reset link shortly.",
      });
      // Don't reset submitting state to prevent re-submission
      // or we could clear the form. Let's keep it disabled.
    } else {
      setMessage({
        type: "error",
        text: result.message || "Something went wrong. Please try again.",
      });
      setIsSubmitting(false);
    }
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
      {/* Message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === "error"
              ? "bg-error-container text-on-error-container"
              : "bg-primary-container text-on-primary-container"
          }`}
          role="alert"
        >
          {message.text}
        </div>
      )}

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
          disabled={isSubmitting}
        />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full bg-primary text-on-primary hover:bg-primary-container hover:text-on-primary-container"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  );
}
