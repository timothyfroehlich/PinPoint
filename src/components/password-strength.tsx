"use client";

import React from "react";
import { useState, useEffect } from "react";
import type { ZxcvbnResult } from "@zxcvbn-ts/core";
import { cn } from "~/lib/utils";

type CheckPassword = (password: string) => ZxcvbnResult;

let checkerPromise: Promise<CheckPassword> | null = null;

/**
 * Load the engine and its dictionaries in one lazy chunk and build the
 * `ZxcvbnFactory` once. The dictionaries are the bulk of the size, so nothing
 * here is bundled with the page.
 */
function loadChecker(): Promise<CheckPassword> {
  checkerPromise ??= Promise.all([
    import("@zxcvbn-ts/core"),
    import("@zxcvbn-ts/language-common"),
    import("@zxcvbn-ts/language-en"),
  ])
    .then(([core, common, en]) => {
      const factory = new core.ZxcvbnFactory({
        translations: en.translations,
        graphs: common.adjacencyGraphs,
        dictionary: { ...common.dictionary, ...en.dictionary },
      });
      return (password: string) => factory.check(password);
    })
    .catch((error: unknown) => {
      // Let a later keystroke retry instead of caching the failure.
      checkerPromise = null;
      throw error;
    });
  return checkerPromise;
}

/**
 * Password Strength Indicator
 *
 * Uses zxcvbn-ts (the maintained TypeScript port of Dropbox's zxcvbn) to
 * evaluate password strength. Shows visual feedback and suggestions for
 * improvement.
 *
 * Advisory only — this client component never gates submission. Password
 * rules are enforced server-side, so the meter cannot pass something the
 * action would reject, or block something it would accept.
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

    // Lazy load so the dictionaries stay out of the page bundle
    loadChecker()
      .then((check) => {
        const result = check(password);
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
    "bg-destructive", // 0: too weak
    "bg-destructive/70", // 1: weak
    "bg-warning", // 2: fair
    "bg-success/70", // 3: good
    "bg-success", // 4: strong
  ];

  const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];

  const color = colors[strength.score] ?? "bg-muted";
  const label = labels[strength.score] ?? "Unknown";
  const widthPercentage = ((strength.score + 1) / 5) * 100;

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", color)}
            style={{ width: `${widthPercentage}%` }}
          />
        </div>
        <span className="text-xs font-medium text-muted-foreground min-w-16">
          {label}
        </span>
      </div>

      {/* Feedback */}
      {strength.feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {strength.feedback.map((message, i) => (
            <li key={i}>• {message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
