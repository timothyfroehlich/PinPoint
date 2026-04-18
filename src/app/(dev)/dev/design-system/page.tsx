import type React from "react";
import { redirect } from "next/navigation";
import { IssueBadge } from "~/components/issues/IssueBadge";
import { IssueBadgeGrid } from "~/components/issues/IssueBadgeGrid";
import { IssueCard } from "~/components/issues/IssueCard";
import { ISSUE_STATUS_VALUES } from "~/lib/issues/status";
import type { IssueSeverity, IssuePriority, IssueFrequency } from "~/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { EmptyState } from "~/components/ui/empty-state";
import { Inbox, SearchX, Plus } from "lucide-react";

/**
 * Design System / Style Guide
 *
 * Living reference page rendering actual components with real tokens.
 * Dev-only — useful for visual consistency auditing and design iteration.
 */
export default function DesignSystemPage(): React.JSX.Element {
  // Gate to development only
  if (process.env["VERCEL_ENV"] === "production") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-16">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Design System</h1>
        <p className="text-muted-foreground">
          Living style guide — renders actual components with real theme tokens.
        </p>
      </div>

      {/* ── Color Palette ─────────────────────────────────── */}
      <ColorPaletteSection />

      {/* ── Surface Hierarchy ─────────────────────────────── */}
      <SurfaceHierarchySection />

      {/* ── Typography Scale ──────────────────────────────── */}
      <TypographySection />

      {/* ── Spacing Rhythm ────────────────────────────────── */}
      <SpacingSection />

      {/* ── Glow Effects ──────────────────────────────────── */}
      <GlowEffectsSection />

      {/* ── Buttons ───────────────────────────────────────── */}
      <ButtonsSection />

      {/* ── Cards ─────────────────────────────────────────── */}
      <CardsSection />

      {/* ── Issue Badges ──────────────────────────────────── */}
      <BadgesSection />

      {/* ── Badge Grid Layouts ────────────────────────────── */}
      <BadgeGridSection />

      {/* ── UI States (PP-vze pre-seeded; filled by PP-yxw.5 + PP-aag) ── */}
      <UIStatesSection />

      {/* ── Date Formatting (PP-vze pre-seeded; filled by PP-yxw.7) ──── */}
      <DateFormattingSection />

      {/* ── Mobile Shell ──────────────────────────────────── */}
      <MobileShellSection />

      {/* ── Page Archetypes ───────────────────────────────── */}
      <PageArchetypesSection />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Section Components
   ════════════════════════════════════════════════════════════ */

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="text-sm text-muted-foreground">{description}</p>
      ) : null}
      <Separator className="mt-2" />
    </div>
  );
}

function ColorSwatch({
  name,
  cssVar,
  hex,
  className,
}: {
  name: string;
  cssVar: string;
  hex: string;
  className?: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <div
        className={`h-16 rounded-lg border border-outline-variant ${className ?? ""}`}
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div className="space-y-0.5">
        <p className="text-xs font-medium">{name}</p>
        <p className="text-[10px] font-mono text-muted-foreground">{cssVar}</p>
        <p className="text-[10px] font-mono text-muted-foreground">{hex}</p>
      </div>
    </div>
  );
}

function ColorPaletteSection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Color Palette"
        description="Theme tokens from globals.css. Hex values are manually mirrored here — the CSS variables are the source of truth."
      />

      {/* Core Colors */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Core
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          <ColorSwatch
            name="Background"
            cssVar="--color-background"
            hex="#0f0f11"
          />
          <ColorSwatch
            name="Foreground"
            cssVar="--color-foreground"
            hex="#f8fafc"
          />
          <ColorSwatch name="Card" cssVar="--color-card" hex="#18151b" />
          <ColorSwatch name="Muted" cssVar="--color-muted" hex="#27272a" />
          <ColorSwatch
            name="Muted FG"
            cssVar="--color-muted-foreground"
            hex="#a1a1aa"
          />
          <ColorSwatch name="Border" cssVar="--color-border" hex="#27272a" />
        </div>
      </div>

      {/* Brand Colors */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Brand
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          <ColorSwatch
            name="Primary (Neon Green)"
            cssVar="--color-primary"
            hex="#4ade80"
          />
          <ColorSwatch
            name="Primary FG"
            cssVar="--color-primary-foreground"
            hex="#022c22"
          />
          <ColorSwatch
            name="Secondary (Purple)"
            cssVar="--color-secondary"
            hex="#d946ef"
          />
          <ColorSwatch
            name="Secondary FG"
            cssVar="--color-secondary-foreground"
            hex="#ffffff"
          />
          <ColorSwatch name="Ring" cssVar="--color-ring" hex="#4ade80" />
          <ColorSwatch
            name="Destructive"
            cssVar="--color-destructive"
            hex="#ef4444"
          />
        </div>
      </div>

      {/* Semantic Colors */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Semantic
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          <ColorSwatch name="Success" cssVar="--color-success" hex="#22c55e" />
          <ColorSwatch name="Warning" cssVar="--color-warning" hex="#eab308" />
          <ColorSwatch name="Error" cssVar="--color-error" hex="#ef4444" />
          <ColorSwatch
            name="Success Container"
            cssVar="--color-success-container"
            hex="#14532d"
          />
          <ColorSwatch
            name="Warning Container"
            cssVar="--color-warning-container"
            hex="#713f12"
          />
          <ColorSwatch
            name="Error Container"
            cssVar="--color-error-container"
            hex="#7f1d1d"
          />
        </div>
      </div>

      {/* Surface Palette */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Surfaces & Outlines
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          <ColorSwatch name="Surface" cssVar="--color-surface" hex="#0f0f11" />
          <ColorSwatch
            name="Surface Variant"
            cssVar="--color-surface-variant"
            hex="#18151b"
          />
          <ColorSwatch name="Outline" cssVar="--color-outline" hex="#3f3f46" />
          <ColorSwatch
            name="Outline Variant"
            cssVar="--color-outline-variant"
            hex="#52525b"
          />
          <ColorSwatch
            name="Primary Container"
            cssVar="--color-primary-container"
            hex="#14532d"
          />
          <ColorSwatch
            name="Secondary Container"
            cssVar="--color-secondary-container"
            hex="#581c87"
          />
        </div>
      </div>

      {/* Status Colors */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Status-Specific
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ColorSwatch
            name="Status: New"
            cssVar="--color-status-new"
            hex="#4ade80"
          />
          <ColorSwatch
            name="Status: In Progress"
            cssVar="--color-status-in-progress"
            hex="#d946ef"
          />
          <ColorSwatch
            name="Status: Unplayable"
            cssVar="--color-status-unplayable"
            hex="#ef4444"
          />
        </div>
      </div>
    </section>
  );
}

function SurfaceHierarchySection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Surface Hierarchy"
        description="Layered surfaces create depth. Opacity + backdrop-blur = frosted glass."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Opaque surfaces */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Opaque Surfaces
          </h3>

          <div className="space-y-3">
            <div className="bg-background p-4 rounded-lg border border-outline-variant">
              <p className="text-xs font-mono text-muted-foreground">
                bg-background
              </p>
              <p className="text-sm">Page background — deepest layer</p>
            </div>
            <div className="bg-surface p-4 rounded-lg border border-outline-variant">
              <p className="text-xs font-mono text-muted-foreground">
                bg-surface
              </p>
              <p className="text-sm">Content areas, full-width sections</p>
            </div>
            <div className="bg-surface-variant p-4 rounded-lg border border-outline-variant">
              <p className="text-xs font-mono text-muted-foreground">
                bg-surface-variant
              </p>
              <p className="text-sm">Slightly elevated variant</p>
            </div>
            <div className="bg-card p-4 rounded-lg border border-outline-variant">
              <p className="text-xs font-mono text-muted-foreground">bg-card</p>
              <p className="text-sm">Cards, popovers — elevated containers</p>
            </div>
          </div>
        </div>

        {/* Frosted glass surfaces */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Frosted Glass (Navigation Chrome)
          </h3>

          {/* Background pattern to show blur effect */}
          <div
            className="relative rounded-lg border border-outline-variant overflow-hidden"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #4ade8015, #4ade8015 10px, transparent 10px, transparent 20px)",
            }}
          >
            <div className="p-4 space-y-3">
              <div className="bg-card/50 backdrop-blur-sm p-3 rounded-lg border border-border">
                <p className="text-xs font-mono text-muted-foreground">
                  bg-card/50 backdrop-blur-sm
                </p>
                <p className="text-sm">Desktop header (current)</p>
              </div>
              <div className="bg-card/85 backdrop-blur-sm p-3 rounded-lg border border-border">
                <p className="text-xs font-mono text-muted-foreground">
                  bg-card/85 backdrop-blur-sm
                </p>
                <p className="text-sm">Mobile header</p>
              </div>
              <div className="bg-card/90 backdrop-blur-sm p-3 rounded-lg border border-primary/50">
                <p className="text-xs font-mono text-muted-foreground">
                  bg-card/90 backdrop-blur-sm
                </p>
                <p className="text-sm">Bottom tab bar</p>
              </div>
              <div className="bg-card p-3 rounded-lg border border-primary/50">
                <p className="text-xs font-mono text-muted-foreground">
                  bg-card (opaque)
                </p>
                <p className="text-sm">Sidebar (no blur)</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground italic">
            Note: Opacity levels are inconsistent — standardization is in
            progress.
          </p>
        </div>
      </div>

      {/* Closed/dimmed state */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          State Modifiers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface p-4 rounded-lg border border-outline-variant hover:border-primary/50 hover:glow-primary transition-all cursor-pointer">
            <p className="text-xs font-mono text-muted-foreground">
              Open item (hover me)
            </p>
            <p className="text-sm">bg-surface + hover:glow-primary</p>
          </div>
          <div className="bg-surface-variant/30 p-4 rounded-lg border border-outline-variant">
            <p className="text-xs font-mono text-muted-foreground">
              Closed/dimmed item
            </p>
            <p className="text-sm">bg-surface-variant/30</p>
          </div>
          <div className="bg-primary/10 p-4 rounded-lg border border-primary/50">
            <p className="text-xs font-mono text-muted-foreground">
              Active/selected
            </p>
            <p className="text-sm">bg-primary/10 + border-primary/50</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TypographySection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Typography Scale"
        description="System font stack. Sizes tied to component context, not arbitrary choice."
      />

      <div className="space-y-6">
        {/* Heading Scale */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Headings
          </h3>
          <div className="space-y-3 border-l-2 border-primary/30 pl-4">
            <div>
              <p className="text-4xl font-extrabold tracking-tight">
                Page Title (h1)
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                text-4xl font-extrabold tracking-tight lg:text-5xl
              </p>
            </div>
            <div>
              <p className="text-3xl font-semibold tracking-tight">
                Section Heading (h2)
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                text-3xl font-semibold tracking-tight
              </p>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                Subsection (h3)
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                text-2xl font-semibold tracking-tight
              </p>
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight">
                Card/Section Heading (h4)
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">
                text-xl font-semibold tracking-tight
              </p>
            </div>
          </div>
        </div>

        {/* Body & UI Text */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Body & UI Text
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3 border-l-2 border-secondary/30 pl-4">
              <div>
                <p className="text-base">Card title (normal)</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-base
                </p>
              </div>
              <div>
                <p className="text-sm">Card title (compact) / body text</p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-sm
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  Metadata, labels, timestamps
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-xs text-muted-foreground
                </p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Code / debug labels
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-[10px] font-mono text-muted-foreground
                </p>
              </div>
            </div>

            <div className="space-y-3 border-l-2 border-secondary/30 pl-4">
              <div>
                <p className="font-mono text-muted-foreground font-bold">
                  AFM-3
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  font-mono font-bold text-muted-foreground (issue IDs)
                </p>
              </div>
              <div>
                <p className="text-xs font-medium underline decoration-primary/30 underline-offset-2">
                  Machine Name
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-xs font-medium underline decoration-primary/30 (machine
                  links in cards)
                </p>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  SECTION LABEL
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-sm font-semibold uppercase tracking-wide
                  text-muted-foreground
                </p>
              </div>
              <div>
                <a className="text-link" href="#">
                  Link text (hover me)
                </a>
                <p className="text-[10px] font-mono text-muted-foreground">
                  text-link (utility class — hover glow)
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SpacingSection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Spacing Rhythm"
        description="Consistent spacing creates visual rhythm. Sizes are contextual."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Page-level spacing */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Page-Level Padding
          </h3>
          <div className="space-y-2">
            {[
              {
                label: "Mobile",
                value: "px-4",
                px: "16px",
              },
              {
                label: "Tablet (sm:)",
                value: "sm:px-8",
                px: "32px",
              },
              {
                label: "Desktop (lg:)",
                value: "lg:px-10",
                px: "40px",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-muted-foreground">{item.label}</span>
                <div
                  className="bg-primary/20 h-8 rounded"
                  style={{ width: item.px }}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {item.value} ({item.px})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Vertical spacing */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Vertical Page Padding (py-*)
          </h3>
          <div className="space-y-2">
            {[
              { label: "Standard page", value: "py-10", px: "40px" },
              { label: "Settings/forms", value: "py-6", px: "24px" },
              {
                label: "Detail (mobile)",
                value: "py-4 sm:py-10",
                px: "16→40px",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className="w-28 text-muted-foreground">{item.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.value} ({item.px})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Gap scale */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Gap Scale
          </h3>
          <div className="space-y-2">
            {[
              { label: "Tight (badge internals)", value: "gap-2", px: "8px" },
              { label: "Standard (card grid)", value: "gap-6", px: "24px" },
              {
                label: "Wide (main+sidebar)",
                value: "gap-8",
                px: "32px",
              },
              {
                label: "Section spacing",
                value: "space-y-6",
                px: "24px",
              },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-sm">
                <span className="w-40 text-muted-foreground">{item.label}</span>
                <div
                  className="bg-secondary/20 h-4 rounded"
                  style={{ width: item.px }}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card padding */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Card Padding
          </h3>
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-mono text-xs text-muted-foreground">
                CardHeader:
              </span>{" "}
              px-6 pt-6 pb-3
            </p>
            <p>
              <span className="font-mono text-xs text-muted-foreground">
                CardContent:
              </span>{" "}
              px-6 pb-6
            </p>
            <p>
              <span className="font-mono text-xs text-muted-foreground">
                Compact card:
              </span>{" "}
              p-3
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GlowEffectsSection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Glow Effects"
        description="Neon glow utilities for interactive elements. Defined in globals.css."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          {
            name: "Primary",
            className: "glow-primary",
            border: "border-primary/50",
          },
          {
            name: "Secondary",
            className: "glow-secondary",
            border: "border-secondary/50",
          },
          {
            name: "Destructive",
            className: "glow-destructive",
            border: "border-destructive/50",
          },
          {
            name: "Warning",
            className: "glow-warning",
            border: "border-warning/50",
          },
          {
            name: "Success",
            className: "glow-success",
            border: "border-success/50",
          },
        ].map((glow) => (
          <div
            key={glow.name}
            className={`${glow.className} bg-card p-4 rounded-lg border ${glow.border} text-center`}
          >
            <p className="text-sm font-medium">{glow.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              {glow.className}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground italic">
        Currently only glow-primary is used (on IssueCard hover). Expanding
        usage is planned.
      </p>
    </section>
  );
}

function ButtonsSection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Buttons"
        description="shadcn/ui Button variants — the only button system."
      />

      <div className="flex flex-wrap gap-4 items-center">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Button size="icon">
          <span aria-hidden="true">+</span>
        </Button>
      </div>
    </section>
  );
}

function CardsSection(): React.JSX.Element {
  const sampleIssue = {
    id: "sample-1",
    title: "Ball gets stuck in left orbit",
    status: "in_progress" as const,
    severity: "major" as const,
    priority: "high" as const,
    frequency: "frequent" as const,
    machineInitials: "AFM",
    issueNumber: 3,
    createdAt: new Date("2025-03-15"),
    reporterName: "Tim",
  };

  const closedIssue = {
    ...sampleIssue,
    id: "sample-2",
    title: "Display not showing credits",
    status: "fixed" as const,
    severity: "minor" as const,
    priority: "low" as const,
    frequency: "intermittent" as const,
    issueNumber: 7,
  };

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Cards"
        description="Card containers and IssueCard variants."
      />

      {/* Base card */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Base Card
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Default Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Standard shadcn/ui card with default padding.
              </p>
            </CardContent>
          </Card>
          <Card className="border-primary/50 hover:glow-primary transition-all">
            <CardHeader>
              <CardTitle>Interactive Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                With border-primary/50 and hover:glow-primary.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Issue Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Issue Cards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Normal variant (open)
            </p>
            <IssueCard
              issue={sampleIssue}
              machine={{ name: "Attack from Mars" }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Normal variant (closed)
            </p>
            <IssueCard
              issue={closedIssue}
              machine={{ name: "Attack from Mars" }}
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Compact variant
            </p>
            <IssueCard
              issue={sampleIssue}
              machine={{ name: "Attack from Mars" }}
              variant="compact"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">With reporter</p>
            <IssueCard
              issue={sampleIssue}
              machine={{ name: "Attack from Mars" }}
              showReporter
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function BadgesSection(): React.JSX.Element {
  const severities: IssueSeverity[] = [
    "cosmetic",
    "minor",
    "major",
    "unplayable",
  ];
  const priorities: IssuePriority[] = ["low", "medium", "high"];
  const frequencies: IssueFrequency[] = [
    "intermittent",
    "frequent",
    "constant",
  ];

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Issue Badges"
        description="Status, severity, priority, and frequency indicators."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Statuses */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ISSUE_STATUS_VALUES.map((status) => (
              <div
                key={status}
                className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
              >
                <IssueBadge type="status" value={status} />
                <span className="text-[10px] font-mono text-muted-foreground">
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* Severities */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Severity
            </h3>
            <div className="flex flex-col gap-2">
              {severities.map((severity) => (
                <div
                  key={severity}
                  className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                >
                  <IssueBadge type="severity" value={severity} />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {severity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
            </h3>
            <div className="flex flex-col gap-2">
              {priorities.map((priority) => (
                <div
                  key={priority}
                  className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                >
                  <IssueBadge type="priority" value={priority} />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {priority}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Frequencies */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Frequency
            </h3>
            <div className="flex flex-col gap-2">
              {frequencies.map((frequency) => (
                <div
                  key={frequency}
                  className="flex items-center gap-3 bg-surface p-2 rounded-lg border border-outline-variant"
                >
                  <IssueBadge type="frequency" value={frequency} />
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {frequency}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BadgeGridSection(): React.JSX.Element {
  const sampleIssue = {
    status: "in_progress" as const,
    severity: "major" as const,
    priority: "high" as const,
    frequency: "frequent" as const,
  };

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Badge Grid Layouts"
        description="IssueBadgeGrid component — grid vs strip layout."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Grid (default) — used in cards
          </h3>
          <div className="bg-surface p-4 rounded-lg border border-outline-variant">
            <IssueBadgeGrid issue={sampleIssue} />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Strip — used in mobile metadata rows
          </h3>
          <div className="bg-surface p-4 rounded-lg border border-outline-variant">
            <IssueBadgeGrid issue={sampleIssue} variant="strip" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Large size
          </h3>
          <div className="bg-surface p-4 rounded-lg border border-outline-variant">
            <IssueBadgeGrid issue={sampleIssue} size="lg" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Without priority (guest view)
          </h3>
          <div className="bg-surface p-4 rounded-lg border border-outline-variant">
            <IssueBadgeGrid issue={sampleIssue} showPriority={false} />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileShellSection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Mobile Shell"
        description="The 52px header + 56px tab bar + safe area contract."
      />

      {/* Visual diagram */}
      <div className="max-w-xs mx-auto">
        <div className="border-2 border-outline-variant rounded-2xl overflow-hidden">
          {/* Status bar */}
          <div className="bg-background h-6 flex items-center justify-center">
            <span className="text-[10px] text-muted-foreground">
              Status Bar
            </span>
          </div>

          {/* Header */}
          <div className="bg-card/85 h-[52px] flex items-center px-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-primary/20" />
              <span className="text-sm font-bold">PinPoint</span>
            </div>
            <div className="ml-auto flex gap-2">
              <div className="w-6 h-6 rounded-full bg-muted" />
              <div className="w-6 h-6 rounded-full bg-muted" />
            </div>
          </div>

          {/* Content area */}
          <div className="bg-background px-3 py-4 space-y-2 min-h-[200px]">
            <p className="text-[10px] font-mono text-muted-foreground text-center">
              scroll-pt-[52px]
            </p>
            <div className="bg-card rounded-lg p-3 border border-outline-variant">
              <div className="h-3 bg-muted rounded w-3/4 mb-2" />
              <div className="h-2 bg-muted/50 rounded w-1/2" />
            </div>
            <div className="bg-card rounded-lg p-3 border border-outline-variant">
              <div className="h-3 bg-muted rounded w-2/3 mb-2" />
              <div className="h-2 bg-muted/50 rounded w-1/3" />
            </div>
            <p className="text-[10px] font-mono text-muted-foreground text-center">
              pb-[calc(88px+safe-area)]
            </p>
          </div>

          {/* Bottom tab bar */}
          <div className="bg-card/90 border-t border-primary/50 flex justify-around py-2 min-h-[56px]">
            {["Home", "Issues", "Machines", "Report", "More"].map((tab) => (
              <div key={tab} className="flex flex-col items-center gap-1">
                <div className="w-5 h-5 rounded bg-muted" />
                <span className="text-[9px] text-muted-foreground">{tab}</span>
              </div>
            ))}
          </div>

          {/* Safe area */}
          <div className="bg-card/90 h-4 flex items-center justify-center">
            <span className="text-[8px] text-muted-foreground">
              env(safe-area-inset-bottom)
            </span>
          </div>
        </div>

        <div className="mt-3 text-center space-y-1">
          <p className="text-xs text-muted-foreground">
            Header: 52px (sticky, z-20)
          </p>
          <p className="text-xs text-muted-foreground">
            Tab bar: 56px min-h (fixed, z-50)
          </p>
          <p className="text-xs text-muted-foreground">
            Breakpoint: md: (768px) hides mobile shell
          </p>
        </div>
      </div>
    </section>
  );
}

function PageArchetypesSection(): React.JSX.Element {
  const archetypes = [
    {
      name: "Dashboard",
      maxWidth: "max-w-6xl",
      grid: "md:grid-cols-3 stats, md:grid-cols-2 lists",
      example: "/dashboard",
    },
    {
      name: "List Page",
      maxWidth: "max-w-7xl",
      grid: "md:grid-cols-2 lg:grid-cols-3",
      example: "/m, /issues",
    },
    {
      name: "Detail + Sidebar",
      maxWidth: "full width",
      grid: "md:grid-cols-[1fr_320px]",
      example: "/m/AFM/i/3",
    },
    {
      name: "Detail + Internal Grid",
      maxWidth: "max-w-6xl",
      grid: "lg:grid-cols-2 inside card",
      example: "/m/AFM",
    },
    {
      name: "Form Page",
      maxWidth: "max-w-2xl",
      grid: "single column",
      example: "/m/new, /report",
    },
    {
      name: "Settings",
      maxWidth: "max-w-3xl",
      grid: "vertical sections + Separator",
      example: "/settings",
    },
    {
      name: "Admin Table",
      maxWidth: "max-w-6xl",
      grid: "full-width Table",
      example: "/admin/users",
    },
    {
      name: "Auth Page",
      maxWidth: "max-w-md",
      grid: "centered card",
      example: "/login, /signup",
    },
    {
      name: "Content Page",
      maxWidth: "max-w-3xl",
      grid: "prose in card",
      example: "/about, /privacy",
    },
    {
      name: "Help Hub",
      maxWidth: "max-w-3xl",
      grid: "sm:grid-cols-2 cards",
      example: "/help",
    },
  ];

  return (
    <section className="space-y-6">
      <SectionHeading
        title="Page Archetypes"
        description="Pick the closest archetype when building a new page."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {archetypes.map((arch) => (
          <div
            key={arch.name}
            className="bg-card p-4 rounded-lg border border-outline-variant space-y-1"
          >
            <p className="text-sm font-semibold">{arch.name}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono">{arch.maxWidth}</span>
              {" — "}
              {arch.grid}
            </p>
            <p className="text-[10px] font-mono text-primary/70">
              {arch.example}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ────────────────────────────────────────────────────────────
   Placeholder sections — pre-seeded by PP-vze (design bible
   expansion, Wave 1 of the consistency pass). Filled in by
   subsequent PRs.
   ──────────────────────────────────────────────────────────── */

function UIStatesSection(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <SectionHeading
        title="UI States"
        description="Canonical empty, loading, and error patterns — see design bible §13. Alert migration (Wave 2b / PP-aag) still pending."
      />

      {/* EmptyState: card variant (default) */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          EmptyState — <code>variant=&quot;card&quot;</code> (default)
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Without action</p>
            <EmptyState
              icon={Inbox}
              title="No items yet"
              description="Items will appear here once they are added."
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">With action</p>
            <EmptyState
              icon={Plus}
              title="No machines yet"
              description="Get started by adding your first machine."
              action={
                <Button variant="outline" size="sm">
                  Add Machine
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* EmptyState: bare variant */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-muted-foreground">
          EmptyState — <code>variant=&quot;bare&quot;</code> (use inside an
          existing card)
        </p>
        <Card>
          <CardContent className="pt-6">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Existing card wrapper
            </p>
            <EmptyState
              variant="bare"
              icon={SearchX}
              title="No matches found"
              description="Try adjusting your filters to see more results."
            />
          </CardContent>
        </Card>
      </div>

      {/* Alert showcase reserved for Wave 2b */}
      <div className="rounded-lg border border-dashed border-outline-variant bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Alert / error state showcase reserved for Wave 2b (PP-aag).
        </p>
      </div>
    </section>
  );
}

function DateFormattingSection(): React.JSX.Element {
  // Filled in by PP-yxw.7 (date formatting utility).
  // Should render:
  //   - formatRelative examples: "just now", "3 minutes ago", "2 days ago"
  //   - formatDate examples: "Apr 17, 2026"
  //   - formatDateTime examples: "Apr 17, 2026, 9:30 PM"
  //   - Null/undefined handling fallback
  // See pinpoint-design-bible SKILL.md §15 for canonical vocabulary.
  return (
    <section className="space-y-6">
      <SectionHeading
        title="Date Formatting"
        description="Canonical helpers from src/lib/dates.ts. Filled in by PP-yxw.7 — see design bible §15."
      />
      <div className="rounded-lg border border-dashed border-outline-variant bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Reserved for formatRelative / formatDate / formatDateTime showcases.
          Filled by Wave 2c (PP-yxw.7).
        </p>
      </div>
    </section>
  );
}
