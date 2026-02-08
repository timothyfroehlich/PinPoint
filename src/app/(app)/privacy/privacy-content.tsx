import React from "react";
import Link from "next/link";

/**
 * Privacy Policy Content
 *
 * This file contains the actual text for the Privacy Policy.
 * Separated from the page layout for easier editing and readability.
 *
 * DRAFT: This content should be reviewed by Tim before public launch.
 */
export function PrivacyContent(): React.JSX.Element {
  return (
    <>
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Introduction</h2>
        <p className="text-muted-foreground">
          PinPoint is an issue tracking tool for the Austin Pinball Collective
          (APC). This Privacy Policy explains what information we collect, how
          we use it, and your rights regarding your data. By using PinPoint, you
          agree to the practices described in this policy.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Information We Collect
        </h2>

        <h3 className="text-lg font-medium text-foreground">Account Data</h3>
        <p className="text-muted-foreground">
          When you create an account, we collect:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Email address</strong> — Used
            for authentication, account recovery, and email notifications (e.g.,
            issue updates, new comments).
          </li>
          <li>
            <strong className="text-foreground">First and last name</strong> —
            Displayed to other users alongside your issue reports and comments.
          </li>
          <li>
            <strong className="text-foreground">Avatar (optional)</strong> — A
            profile image you may choose to upload.
          </li>
          <li>
            <strong className="text-foreground">Role</strong> — Your permission
            level (guest, member, or admin), assigned by administrators.
          </li>
          <li>
            <strong className="text-foreground">
              Terms of Service acceptance
            </strong>{" "}
            — A timestamp of when you accepted the Terms of Service.
          </li>
        </ul>

        <h3 className="text-lg font-medium text-foreground mt-4">
          Content You Create
        </h3>
        <p className="text-muted-foreground">
          When you use PinPoint, you may submit:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Issue reports</strong> —
            Descriptions of problems with pinball machines, including title,
            description, severity, and status.
          </li>
          <li>
            <strong className="text-foreground">Comments</strong> — Text
            responses on issue reports.
          </li>
          <li>
            <strong className="text-foreground">Images</strong> — Photos
            uploaded to illustrate issues. Images are stored in Vercel Blob
            Storage and may include file metadata (file name, size, MIME type).
            We do not extract or store EXIF data from uploaded images.
          </li>
        </ul>

        <h3 className="text-lg font-medium text-foreground mt-4">
          Automatically Collected Data
        </h3>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">IP addresses</strong> — Used
            temporarily for rate limiting to prevent abuse (e.g., login
            attempts, issue submissions, image uploads). IP-based rate limit
            data is stored in Upstash Redis and automatically expires after
            short windows (15 minutes to 1 hour). We do not maintain long-term
            logs of IP addresses.
          </li>
          <li>
            <strong className="text-foreground">
              Error and performance data
            </strong>{" "}
            — We use Sentry for error tracking to help us identify and fix bugs.
            Sentry collects error stack traces, browser/device information, and
            page URLs where errors occur. We have disabled the collection of
            personally identifiable information (PII) in Sentry.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Cookies and Local Storage
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">
              Authentication session cookies
            </strong>{" "}
            — Managed by Supabase Auth to keep you logged in. These are
            essential for the service to function and cannot be disabled.
          </li>
          <li>
            <strong className="text-foreground">Preference cookies</strong> —
            Used to remember your UI preferences, such as sidebar state and last
            visited page. These cookies expire after one year.
          </li>
          <li>
            <strong className="text-foreground">Local storage</strong> — Used by
            your browser to store certain app data on your device, such as
            in-progress report form drafts or similar UI state. This data stays
            on your device, is not shared with third parties, and you can clear
            it at any time through your browser settings.
          </li>
        </ul>
        <p className="text-muted-foreground">
          We do not use any analytics cookies, advertising cookies, or
          third-party tracking technologies based on cookies or local storage.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          How We Use Your Information
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            To operate and maintain PinPoint as an issue tracking tool for APC.
          </li>
          <li>To authenticate your identity and manage your account.</li>
          <li>
            To send you email notifications about issues you are watching or
            assigned to (you can manage your notification preferences in your
            account settings).
          </li>
          <li>To prevent abuse through rate limiting.</li>
          <li>To identify and fix errors and improve service reliability.</li>
        </ul>
        <p className="text-muted-foreground">
          We do not sell, rent, or share your personal information with third
          parties for marketing purposes.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Third-Party Services
        </h2>
        <p className="text-muted-foreground">
          PinPoint relies on the following third-party services to operate. Each
          service has its own privacy policy governing how it handles data:
        </p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">
              Supabase (Authentication and Database)
            </strong>{" "}
            — Manages user authentication and stores application data. Hosted on
            AWS infrastructure.
          </li>
          <li>
            <strong className="text-foreground">Vercel (Hosting)</strong> —
            Hosts the PinPoint web application and provides blob storage for
            uploaded images.
          </li>
          <li>
            <strong className="text-foreground">Sentry (Error Tracking)</strong>{" "}
            — Captures error reports to help us diagnose and fix issues. PII
            collection is disabled.
          </li>
          <li>
            <strong className="text-foreground">
              Upstash Redis (Rate Limiting)
            </strong>{" "}
            — Stores temporary rate limit counters keyed by IP address. Data
            expires automatically.
          </li>
          <li>
            <strong className="text-foreground">Resend (Email Delivery)</strong>{" "}
            — Delivers notification emails on our behalf.
          </li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Data Retention
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Account data</strong> — Retained
            for as long as your account is active.
          </li>
          <li>
            <strong className="text-foreground">
              Issue reports and comments
            </strong>{" "}
            — Retained indefinitely as part of the community&apos;s maintenance
            history. If you delete your account, your contributions may be
            anonymized rather than deleted to preserve the historical record.
          </li>
          <li>
            <strong className="text-foreground">Uploaded images</strong> —
            Retained while associated with active issues. Soft-deleted images
            are marked for permanent removal and may be deleted during future
            cleanup cycles; we do not currently guarantee a specific deletion
            timeframe.
          </li>
          <li>
            <strong className="text-foreground">Rate limit data</strong> —
            Automatically expires after 15 minutes to 1 hour depending on the
            endpoint.
          </li>
          <li>
            <strong className="text-foreground">Error tracking data</strong> —
            Retained according to Sentry&apos;s default retention policy (90
            days).
          </li>
        </ul>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Your Rights</h2>
        <p className="text-muted-foreground">You have the right to:</p>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Access your data</strong> —
            Request a copy of the personal data we hold about you.
          </li>
          <li>
            <strong className="text-foreground">Correct your data</strong> —
            Update your name through your account settings. For other account
            details, contact us to request corrections.
          </li>
          <li>
            <strong className="text-foreground">Delete your account</strong> —
            Request deletion of your account and associated personal data.
          </li>
          <li>
            <strong className="text-foreground">Manage notifications</strong> —
            Control which email notifications you receive through your account
            settings.
          </li>
        </ul>
        <p className="text-muted-foreground">
          To exercise any of these rights, please contact us at the email
          address listed below.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Children&apos;s Privacy
        </h2>
        <p className="text-muted-foreground">
          PinPoint is not intended for use by children under the age of 13. We
          do not knowingly collect personal information from children under 13.
          If you believe we have inadvertently collected such information,
          please contact us and we will promptly delete it.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">
          Changes to This Policy
        </h2>
        <p className="text-muted-foreground">
          We may update this Privacy Policy from time to time. If we make
          significant changes, we will notify users through the application.
          Continued use of PinPoint after changes constitutes acceptance of the
          updated policy.
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <h2 className="text-xl font-semibold text-foreground">Contact</h2>
        <p className="text-muted-foreground">
          If you have questions about this Privacy Policy or wish to exercise
          your data rights, please contact:
        </p>
        <p className="text-muted-foreground">
          Tim Froehlich
          <br />
          <a href="mailto:timothyfroehlich@gmail.com" className="text-link">
            timothyfroehlich@gmail.com
          </a>
        </p>
      </section>

      <section className="space-y-4 mt-6">
        <p className="text-muted-foreground">
          See also our{" "}
          <Link href="/terms" className="text-link">
            Terms of Service
          </Link>
          .
        </p>
      </section>
    </>
  );
}
