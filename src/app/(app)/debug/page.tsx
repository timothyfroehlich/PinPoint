import type React from "react";
import Link from "next/link";
import {
  Palette,
  Type,
  Square,
  LayoutGrid,
  Layers,
  Tag,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

const sections = [
  {
    href: "/debug/colors",
    icon: Palette,
    title: "Colors",
    description:
      "All CSS variable tokens — backgrounds, semantic colors, status, glow effects. Never use raw Tailwind palette colors.",
    rule: "CORE-UI-005",
  },
  {
    href: "/debug/typography",
    icon: Type,
    title: "Typography",
    description:
      "Heading hierarchy, section headings, paragraph text, muted text, text-link, and code.",
    rule: "CORE-UI-007",
  },
  {
    href: "/debug/components",
    icon: Square,
    title: "Components",
    description:
      "Button variants and sizes, inputs, selects, checkboxes, alerts. Shadcn/ui only.",
    rule: "CORE-UI-011",
  },
  {
    href: "/debug/cards",
    icon: LayoutGrid,
    title: "Cards",
    description:
      "The 5 canonical card variants (neutral, primary, success, warning, destructive) plus stat and machine card patterns.",
    rule: "CORE-UI-009",
  },
  {
    href: "/debug/states",
    icon: Layers,
    title: "States",
    description:
      "Empty state pattern, skeleton loading, error state. Every list needs an empty state.",
    rule: "CORE-UI-010",
  },
  {
    href: "/debug/badges",
    icon: Tag,
    title: "Badges",
    description:
      "IssueBadge for status, severity, priority, frequency. Single source of truth for domain values.",
    rule: "CORE-UI-015",
  },
  {
    href: "/debug/layout",
    icon: Smartphone,
    title: "Layout & Responsive",
    description:
      "Page container, grid patterns, mobile-first breakpoints, and what changes between mobile and desktop.",
    rule: "CORE-UI-017",
  },
];

export default function DebugIndexPage(): React.JSX.Element {
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">
          Dev Style Guide
        </h2>
        <p className="text-muted-foreground">
          Live reference for UI patterns. Use these pages to verify visual
          consistency during reviews and as a copy-paste source when building
          new pages. Rules are documented in{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            docs/UI_NON_NEGOTIABLES.md
          </code>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map(({ href, icon: Icon, title, description, rule }) => (
          <Link key={href} href={href}>
            <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base text-foreground">
                      {title}
                    </CardTitle>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {rule}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="border-t border-border pt-6">
        <p className="text-xs text-muted-foreground">
          This page is only reachable in development. It renders actual
          components — what you see here is what production looks like.
        </p>
      </div>
    </div>
  );
}
