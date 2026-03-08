import type React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

function Section({
  title,
  rule,
  note,
  children,
}: {
  title: string;
  rule?: string;
  note?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline gap-3 border-b border-border pb-2">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {rule && (
          <span className="text-xs font-mono text-muted-foreground">
            {rule}
          </span>
        )}
      </div>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }): React.JSX.Element {
  return (
    <pre className="text-xs bg-muted border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground">
      <code>{children}</code>
    </pre>
  );
}

function BreakpointBadge({
  label,
  width,
  description,
}: {
  label: string;
  width: string;
  description: string;
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-3 p-3 border border-border rounded-lg bg-card">
      <code className="text-sm font-mono text-primary shrink-0">{label}:</code>
      <div>
        <p className="text-sm text-foreground font-medium">{width}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function LayoutPage(): React.JSX.Element {
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Layout & Responsive Patterns
        </h2>
        <p className="text-muted-foreground">
          Mobile-first. All layouts start single-column and expand at
          breakpoints. The app shell (sidebar, header, bottom nav) is handled by{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            MainLayout
          </code>{" "}
          — page content does not need to account for it.
        </p>
        <div className="inline-flex items-center gap-2 bg-warning-container text-on-warning-container text-xs px-3 py-1.5 rounded-lg">
          <strong>CORE-UI-017:</strong> mobile-first, standard breakpoints, no
          desktop-only pages
        </div>
      </div>

      {/* Page container */}
      <Section
        title="Page Container"
        rule="CORE-UI-006"
        note="Every authenticated page uses this outer container. The sidebar/header padding is added by MainLayout — don't add extra horizontal padding to page containers."
      >
        <CodeBlock>{`// ✅ CORRECT — standard page container
<div className="max-w-6xl mx-auto py-10 space-y-6">
  {/* page sections */}
</div>

// ❌ WRONG — different max-width
<div className="max-w-4xl mx-auto py-8">

// ❌ WRONG — adding horizontal padding (MainLayout handles it)
<div className="max-w-6xl mx-auto px-4 py-10">`}</CodeBlock>
      </Section>

      {/* Breakpoints */}
      <Section
        title="Tailwind Breakpoints"
        note="Use these exact breakpoints. Always mobile-first (no-prefix = mobile). Never use max-width queries."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <BreakpointBadge
            label="(none)"
            width="0–639px"
            description="Mobile default. Single column, compact spacing."
          />
          <BreakpointBadge
            label="sm:"
            width="640px+"
            description="Larger phones / small tablets. Rare — use sparingly."
          />
          <BreakpointBadge
            label="md:"
            width="768px+"
            description="Tablet / small desktop. Most 2-column layouts activate here."
          />
          <BreakpointBadge
            label="lg:"
            width="1024px+"
            description="Desktop. 3-column layouts, sidebar visible."
          />
          <BreakpointBadge
            label="xl:"
            width="1280px+"
            description="Large desktop. Use rarely — max-w-6xl limits content width."
          />
          <BreakpointBadge
            label="table-assignee:"
            width="950px+"
            description="Custom: show Assignee column in issue table. From globals.css."
          />
          <BreakpointBadge
            label="table-modified:"
            width="1100px+"
            description="Custom: show Modified column in issue table. From globals.css."
          />
        </div>
        <CodeBlock>{`// Always mobile-first (no prefix = mobile, add prefix for larger)
// ❌ WRONG — desktop-first (max-width queries)
<div className="grid-cols-3 md:grid-cols-1">

// ✅ CORRECT — mobile-first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// Custom breakpoints from globals.css
<td className="hidden table-assignee:table-cell">Assignee</td>
<td className="hidden table-modified:table-cell">Modified</td>`}</CodeBlock>
      </Section>

      {/* Grid patterns */}
      <Section
        title="Standard Grid Patterns"
        note="These are the established column patterns used across the app. Use the one that fits your content density."
      >
        <div className="space-y-6">
          {/* 1 → 2 → 3 */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">
              grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 — Stat cards,
              machine cards
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="py-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      Column {i}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 1 → 2 */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">
              grid-cols-1 md:grid-cols-2 gap-3 — Issue cards, compact content
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2].map((i) => (
                <Card key={i} className="border-border bg-card">
                  <CardContent className="py-4 text-center">
                    <span className="text-sm text-muted-foreground">
                      Column {i}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <CodeBlock>{`// Stat cards, machine cards (3-up on desktop)
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">

// Issue cards (2-up on desktop, denser)
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">

// Full-width to 3/4 layout (sidebar-style panels)
<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-stretch">

// Grid gaps: gap-4 (compact), gap-6 (section-level)`}</CodeBlock>
        </div>
      </Section>

      {/* Mobile-specific patterns */}
      <Section
        title="Mobile vs Desktop Differences"
        note="The app shell changes significantly on mobile. These are the key differences."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Desktop</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                Left sidebar for navigation (persistent)
              </li>
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                Top header with user menu and search
              </li>
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                3-column grids available (lg:grid-cols-3)
              </li>
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                Table columns: assignee (950px+), modified (1100px+)
              </li>
              <li className="flex gap-2">
                <span className="text-primary">→</span>
                Organization banner visible (hidden lg:block)
              </li>
            </ul>
          </div>
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Mobile</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-secondary">→</span>
                Bottom tab bar replaces sidebar (BottomTabBar)
              </li>
              <li className="flex gap-2">
                <span className="text-secondary">→</span>
                Mobile header (MobileHeader) — hamburger + sheet drawer
              </li>
              <li className="flex gap-2">
                <span className="text-secondary">→</span>
                Single column layout (grid-cols-1 default)
              </li>
              <li className="flex gap-2">
                <span className="text-secondary">→</span>
                Table columns hidden (hidden table-assignee:table-cell)
              </li>
              <li className="flex gap-2">
                <span className="text-secondary">→</span>
                Long text truncated (truncate, line-clamp-2)
              </li>
            </ul>
          </div>
        </div>

        <CodeBlock>{`// Hide on mobile, show on desktop
<div className="hidden lg:block">Desktop-only content</div>
<div className="hidden md:flex">Tablet+ content</div>

// Show on mobile, hide on desktop
<div className="lg:hidden">Mobile-only content</div>

// Truncate long text on mobile
<p className="truncate md:whitespace-normal">Long machine name</p>
<p className="line-clamp-2 md:line-clamp-none">Long description</p>

// Table column visibility
<th className="hidden table-assignee:table-cell">Assignee</th>
<td className="hidden table-assignee:table-cell">{assignee}</td>

// Responsive text sizes (rare — use sparingly)
<h1 className="text-4xl lg:text-5xl font-extrabold">

// ❌ WRONG — desktop-only layout (no mobile consideration)
<div className="grid grid-cols-3 gap-6">

// ✅ CORRECT — mobile-first
<div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">`}</CodeBlock>
      </Section>

      {/* Spacing rhythm */}
      <Section
        title="Spacing Rhythm"
        note="Consistent spacing within and between sections. Use these values — don't invent new ones."
      >
        <div className="space-y-3">
          {[
            {
              token: "space-y-2",
              px: "8px",
              use: "Label + input pairs, tight stacks",
            },
            {
              token: "space-y-3",
              px: "12px",
              use: "Items in a list or group",
            },
            {
              token: "space-y-4",
              px: "16px",
              use: "Within a section (heading + content)",
            },
            {
              token: "space-y-6",
              px: "24px",
              use: "Between page-level sections",
            },
            {
              token: "space-y-8",
              px: "32px",
              use: "Between major page sections (style guide pages)",
            },
            {
              token: "space-y-10",
              px: "40px",
              use: "Top-level page container (py-10)",
            },
            { token: "gap-3", px: "12px", use: "Dense grids (issue cards)" },
            { token: "gap-4", px: "16px", use: "Standard grid gaps" },
            { token: "gap-6", px: "24px", use: "Section-level grid gaps" },
          ].map(({ token, px, use }) => (
            <div
              key={token}
              className="flex items-center gap-4 p-2 border border-border rounded-lg bg-card"
            >
              <code className="text-xs font-mono text-primary w-28 shrink-0">
                {token}
              </code>
              <span className="text-xs text-muted-foreground w-10 shrink-0">
                {px}
              </span>
              <span className="text-xs text-muted-foreground">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Section-level aside pattern */}
      <Section
        title="Sidebar Panel Pattern"
        note="Used on Dashboard for the organization banner — a main content area + a fixed-width side panel."
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-stretch">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Main Content (flex-1)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Takes remaining space. On mobile, stacks above the panel.
              </p>
            </CardContent>
          </Card>
          <div className="hidden lg:block w-64">
            <Card className="border-border bg-card h-full">
              <CardHeader>
                <CardTitle className="text-base">Side Panel (w-64)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Fixed width on desktop. Hidden on mobile (hidden lg:block).
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        <CodeBlock>{`<div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-stretch">
  {/* Main content */}
  <div className="flex-1">
    {/* content */}
  </div>

  {/* Side panel — hidden on mobile */}
  <div className="hidden lg:block w-64">
    {/* panel content */}
  </div>
</div>`}</CodeBlock>
      </Section>
    </div>
  );
}
