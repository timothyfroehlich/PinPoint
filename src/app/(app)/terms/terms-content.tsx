import React from "react";
import Link from "next/link";

/**
 * Terms of Service Content
 *
 * This file contains the actual text for the Terms of Service.
 * Separated from the page layout for easier editing and readability.
 */
export function TermsContent(): React.JSX.Element {
  return (
    <>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">
          Welcome to PinPoint
        </h2>
        <p className="text-muted-foreground">
          PinPoint is an issue tracking tool for the Austin Pinball Collective
          (APC). By creating an account and using this service, you agree to
          these terms.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Community Guidelines
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Be helpful:</strong> Report
            issues accurately and constructively to help keep machines running.
          </li>
          <li>
            <strong className="text-foreground">Be respectful:</strong> Treat
            other community members and their contributions with respect.
          </li>
          <li>
            <strong className="text-foreground">Be honest:</strong> Only report
            genuine issues you&apos;ve observed. Don&apos;t create fake or
            misleading reports.
          </li>
          <li>
            <strong className="text-foreground">No spam:</strong> Don&apos;t use
            the platform for advertising, spam, or unrelated content.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Your Account</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            You are responsible for keeping your login credentials secure.
          </li>
          <li>
            You are responsible for all activity that occurs under your account.
          </li>
          <li>
            We may suspend or terminate accounts that violate these terms.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Your Content</h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            You retain ownership of content you submit (issue reports, comments,
            images).
          </li>
          <li>
            By submitting content, you grant PinPoint and APC a license to
            display and use that content for operating the service.
          </li>
          <li>
            Don&apos;t upload content that violates others&apos; rights or
            contains harmful material.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Privacy</h2>
        <p className="text-muted-foreground">
          We collect your email address and name to operate your account. Issue
          reports and comments you create are visible to other users. We
          don&apos;t sell your personal information to third parties. For full
          details on how we handle your data, please see our{" "}
          <Link href="/privacy" className="text-link">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Disclaimer</h2>
        <p className="text-muted-foreground">
          PinPoint is provided &quot;as is&quot; without warranties. We strive
          to keep the service running but cannot guarantee uninterrupted access.
          APC and PinPoint administrators are not liable for any damages arising
          from use of this service.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Changes to Terms
        </h2>
        <p className="text-muted-foreground">
          We may update these terms from time to time. Continued use of PinPoint
          after changes constitutes acceptance of the new terms.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Contact</h2>
        <p className="text-muted-foreground">
          Questions about these terms? Contact the Austin Pinball Collective
          administrators.
        </p>
      </section>
    </>
  );
}
