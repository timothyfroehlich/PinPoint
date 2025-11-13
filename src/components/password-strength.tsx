"use client";

import { useState, useEffect } from "react";
import type React from "react";

/**
 * Password Strength Indicator
 *
 * Uses zxcvbn (Dropbox's password strength library) to evaluate password strength.
 * Shows visual feedback and suggestions for improvement.
 *
 * Progressive enhancement: This is a client component for interactivity,
 * but the form still works without JavaScript (validation happens server-side).
 */
export function PasswordStrength({
  password,
}: {
  password: string;
}): React.JSX.Element {
  const [strength, setStrength] = useState<{
    score: number;
    feedback: string[];
  } | null>(null);

  useEffect(() => {
    if (!password || password.length < 8) {
      setStrength(null);
      return;
    }

    // Dynamic import to avoid bundling zxcvbn upfront (it's ~800KB)
    import("zxcvbn")
      .then((mod) => {
        const result = mod.default(password);
        const feedback: string[] = [];

        if (result.feedback.warning) {
          feedback.push(result.feedback.warning);
        }

        if (result.feedback.suggestions.length > 0) {
          feedback.push(...result.feedback.suggestions);
        }

        setStrength({
          score: result.score,
          feedback,
        });
      })
      .catch(() => {
        // Fail silently - not critical if strength meter doesn't work
        setStrength(null);
      });
  }, [password]);

  if (!strength || password.length < 8) {
    return <></>;
  }

  const colors = [
    "bg-red-500", // 0: too weak
    "bg-orange-500", // 1: weak
    "bg-yellow-500", // 2: fair
    "bg-lime-500", // 3: good
    "bg-green-600", // 4: strong
  ];

  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];

  const color = colors[strength.score] ?? "bg-gray-300";
  const label = labels[strength.score] ?? "Unknown";
  const widthPercentage = ((strength.score + 1) / 5) * 100;

  return (
    <div className="space-y-2" data-testid="password-strength">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
          <div
            className={`h-full ${color} transition-all duration-300`}
            style={{ width: `${widthPercentage}%` }}
          />
        </div>
        <span
          className="text-xs font-medium text-on-surface-variant min-w-16"
          data-testid="password-strength-label"
        >
          {label}
        </span>
      </div>

      {/* Feedback */}
      {strength.feedback.length > 0 && (
        <ul
          className="text-xs text-on-surface-variant space-y-1"
          data-testid="password-strength-feedback"
        >
          {strength.feedback.map((message, i) => (
            <li key={i}>• {message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
