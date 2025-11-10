/**
 * Form Enhancement Client Island
 * Phase 3D: Focused client island for enhanced form UX
 * Provides loading states, validation, and optimistic updates
 */

"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { createIssueAction } from "~/lib/actions/issue-actions";
import { useEffect, useRef } from "react";

/**
 * Enhanced submit button with loading state
 * Replaces server submit button when JavaScript is available
 */
function EnhancedSubmitButton({
  isPending,
}: {
  isPending: boolean;
}): JSX.Element {
  const { pending } = useFormStatus();
  const isLoading = isPending || pending;

  return (
    <Button
      type="submit"
      disabled={isLoading}
      className="w-full"
      style={{ display: "none" }} // Hidden by default, shown by JS
    >
      {isLoading ? "Creating Issue..." : "Create Issue"}
    </Button>
  );
}

/**
 * Client island for form enhancement
 * Provides enhanced UX when JavaScript is available
 * Falls back gracefully to server-rendered form
 */
export function FormEnhancementClient(): JSX.Element {
  const [state, formAction, isPending] = useActionState(
    createIssueAction,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Progressive enhancement: hide server button, show enhanced button
  useEffect(() => {
    const form = document.querySelector("form");
    const serverButton = form?.querySelector(
      'button[type="submit"]:not([style*="display: none"])',
    );
    const clientButton = form?.querySelector('button[style*="display: none"]');

    if (serverButton && clientButton) {
      (serverButton as HTMLElement).style.display = "none";
      (clientButton as HTMLElement).style.display = "block";
    }

    // Set enhanced form action
    if (form) {
      form.action = "";
      form.onsubmit = null;
      form.setAttribute("data-enhanced", "true");
    }
  }, []);

  // Reset form on successful submission
  useEffect(() => {
    if (state?.success && formRef.current) {
      formRef.current.reset();
    }
  }, [state?.success]);

  // Attach to nearest form
  useEffect(() => {
    const form = document.querySelector("form");
    if (form && !form.hasAttribute("data-enhanced")) {
      form.setAttribute("action", "");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        formAction(formData);
      });
    }
  }, [formAction]);

  return (
    <div>
      {/* Enhanced submit button (shown when JS available) */}
      <EnhancedSubmitButton isPending={isPending} />

      {/* Enhanced error/success messages */}
      {state && !state.success && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state && state.success && state.message && (
        <Alert className="mt-4">
          <AlertDescription>✅ {state.message}</AlertDescription>
        </Alert>
      )}

      {/* Field-level validation errors */}
      {state && !state.success && state.fieldErrors && (
        <div className="space-y-2 mt-4">
          {Object.entries(state.fieldErrors).map(([field, errors]) => {
            // Add error styling to field (side effect in render, but for progressive enhancement)
            const fieldElement = document.querySelector(`[name="${field}"]`);
            if (fieldElement && Array.isArray(errors) && errors.length > 0) {
              fieldElement.classList.add("border-error");
              fieldElement.setAttribute("aria-invalid", "true");
            }

            return (
              <div key={field} className="text-sm text-destructive">
                <strong>{field}:</strong>{" "}
                {Array.isArray(errors) ? errors[0] : errors}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
