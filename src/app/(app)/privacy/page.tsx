import type React from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { PrivacyContent } from "./privacy-content";

export const metadata: Metadata = {
  title: "Privacy Policy - PinPoint",
  description: "Privacy Policy for PinPoint - Austin Pinball Collective",
};

/**
 * Privacy Policy Page
 *
 * Describes what data PinPoint collects, how it is used, and user rights.
 * Content is extracted to privacy-content.tsx for readability.
 */
export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">Privacy Policy</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: February 2026
          </p>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none">
          <PrivacyContent />
        </CardContent>
      </Card>
    </div>
  );
}
