import type React from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TermsContent } from "./terms-content";

export const metadata: Metadata = {
  title: "Terms of Service - PinPoint",
  description: "Terms of Service for PinPoint - Austin Pinball Collective",
};

/**
 * Terms of Service Page
 *
 * Basic terms for using PinPoint to track issues at Austin Pinball Collective.
 * Content is extracted to terms-content.tsx for readability.
 */
export default function TermsPage(): React.JSX.Element {
  return (
    <div className="max-w-3xl mx-auto space-y-6 px-4 sm:px-6">
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-2xl">Terms of Service</CardTitle>
          <p className="text-sm text-muted-foreground">
            Last updated: February 2026
          </p>
        </CardHeader>
        <CardContent className="prose prose-invert max-w-none">
          <TermsContent />
        </CardContent>
      </Card>
    </div>
  );
}
