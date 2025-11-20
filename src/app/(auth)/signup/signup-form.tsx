"use client";

import { useState } from "react";
import type React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { PasswordStrength } from "~/components/password-strength";

/**
 * Signup Form Client Component
 *
 * Wraps the signup form to add password strength indicator.
 * Progressive enhancement - form still works without JavaScript.
 */
export function SignupForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}): React.JSX.Element {
  const [password, setPassword] = useState("");

  return (
    <form action={action} className="space-y-4">
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
          className="bg-muted"
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
          className="bg-muted"
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
          className="bg-muted"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Minimum 8 characters</p>

        {/* Password strength indicator */}
        <PasswordStrength password={password} />
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        size="lg"
      >
        Create Account
      </Button>
    </form>
  );
}
