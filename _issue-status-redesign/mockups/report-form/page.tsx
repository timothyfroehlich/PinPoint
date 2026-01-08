import type React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import {
  ALL_SEVERITIES,
  ALL_CONSISTENCIES,
  getIssueSeverityLabel,
  getIssueConsistencyLabel,
} from "../badge-utils";

/**
 * Badge Preview - Report Form
 *
 * Shows how the public report form will look with the new fields.
 * Public users will see: Severity and Consistency dropdowns.
 */

export default function ReportFormPreviewPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Preview - Report Form</h1>
          <p className="text-muted-foreground">
            How the public report form will look with new Severity values and Consistency field.
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to All Badges
          </Link>
        </div>

        {/* Mock Report Form */}
        <Card className="border-border bg-card shadow-md">
          <CardHeader className="space-y-1.5 pb-4 border-b border-border/50">
            <CardTitle className="text-2xl font-bold">Report an Issue</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tell us what&apos;s going on and the maintenance crew will take it from here.
            </p>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            {/* Machine Select */}
            <div className="space-y-1.5">
              <Label htmlFor="machine">Machine *</Label>
              <select
                id="machine"
                className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm"
                defaultValue="taf"
              >
                <option value="" disabled>Select a machine...</option>
                <option value="taf">The Addams Family (TAF)</option>
                <option value="mm">Medieval Madness (MM)</option>
                <option value="afm">Attack from Mars (AFM)</option>
              </select>
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="title">Issue Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Left flipper not responding"
                className="h-9 border-border bg-background"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                placeholder="Tell us what happened, and how often it occurs."
                className="min-h-[80px] border-border bg-background"
              />
            </div>

            {/* Severity and Consistency - Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* NEW: Severity Options */}
              <div className="space-y-1.5">
                <Label htmlFor="severity">Severity *</Label>
                <select
                  id="severity"
                  className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select severity...</option>
                  {ALL_SEVERITIES.map((sev) => (
                    <option key={sev} value={sev}>
                      {getIssueSeverityLabel(sev)}
                      {sev === "cosmetic" && " (visual only)"}
                      {sev === "minor" && " (small annoyance)"}
                      {sev === "major" && " (affects gameplay)"}
                      {sev === "unplayable" && " (can't play)"}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  How bad is the problem?
                </p>
              </div>

              {/* NEW: Consistency Field */}
              <div className="space-y-1.5">
                <Label htmlFor="consistency">Consistency *</Label>
                <select
                  id="consistency"
                  className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Select consistency...</option>
                  {ALL_CONSISTENCIES.map((con) => (
                    <option key={con} value={con}>
                      {getIssueConsistencyLabel(con)}
                      {con === "constant" && " (always happens)"}
                      {con === "frequent" && " (>25% of the time)"}
                      {con === "intermittent" && " (<25% of the time)"}
                      {con === "unsure" && " (not sure)"}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  How often does it happen?
                </p>
              </div>
            </div>

            {/* Reporter Info (for unauthenticated users) */}
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold">Your Information (Optional)</h3>
              </div>
              <div className="space-y-3 rounded-lg border border-border/30 bg-muted/20 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName" className="text-xs">First Name</Label>
                    <Input id="firstName" className="h-8 border-border bg-background text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="lastName" className="text-xs">Last Name</Label>
                    <Input id="lastName" className="h-8 border-border bg-background text-sm" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email Address</Label>
                  <Input id="email" type="email" className="h-8 border-border bg-background text-sm" />
                  <p className="text-[10px] text-muted-foreground">
                    Verified emails link to your profile.
                  </p>
                </div>
              </div>
            </div>

            <Button className="w-full bg-primary text-primary-foreground mt-2 h-10 text-sm font-semibold">
              Submit Issue Report
            </Button>
          </CardContent>
        </Card>

        {/* Comparison: Old vs New */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Old vs New Severity Options
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-medium text-muted-foreground">Old (Current)</h3>
              <ul className="text-sm space-y-1">
                <li>• Minor</li>
                <li>• Playable</li>
                <li>• Unplayable</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-primary">New</h3>
              <ul className="text-sm space-y-1">
                <li>• <strong>Cosmetic</strong> (visual only)</li>
                <li>• <strong>Minor</strong> (small annoyance)</li>
                <li>• <strong>Major</strong> (affects gameplay)</li>
                <li>• <strong>Unplayable</strong> (can&apos;t play)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Layout Notes */}
        <div className="p-4 bg-card rounded-lg border border-border space-y-2">
          <h3 className="font-semibold">Report Form Layout Notes</h3>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Public users see <strong>Severity</strong> and <strong>Consistency</strong> dropdowns</li>
            <li>Priority is NOT shown to public (member/admin only)</li>
            <li>Status is automatically set to &quot;new&quot;</li>
            <li>Severity options have helpful descriptions in parentheses</li>
            <li>Consistency options have percentage guidance</li>
            <li>Both fields are required (*)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
