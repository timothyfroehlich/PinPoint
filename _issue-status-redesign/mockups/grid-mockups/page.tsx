import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";
import {
  Circle,
  CircleDot,
  Disc,
  CircleDashed,
  CircleX,
  CirclePlay,
  CirclePause,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  AlertOctagon,
  Info,
  Zap,
  Flame,
  TrendingUp,
  ArrowUp,
  ChevronUp,
  Signal,
  Gauge,
  Timer,
  RefreshCw,
  RotateCcw,
  Repeat,
  Clock,
  HelpCircle,
} from "lucide-react";

/**
 * Badge Grid Mockups
 *
 * Exploring different layouts and icon options for showing all 4 badges.
 */

// Icon options for each badge type
const ICON_OPTIONS = {
  status: {
    option1: { icon: CircleDot, name: "CircleDot" },
    option2: { icon: Circle, name: "Circle" },
    option3: { icon: CirclePlay, name: "CirclePlay" },
    option4: { icon: Gauge, name: "Gauge" },
  },
  severity: {
    option1: { icon: AlertTriangle, name: "AlertTriangle" },
    option2: { icon: AlertCircle, name: "AlertCircle" },
    option3: { icon: AlertOctagon, name: "AlertOctagon" },
    option4: { icon: Zap, name: "Zap" },
  },
  priority: {
    option1: { icon: Flame, name: "Flame" },
    option2: { icon: ArrowUp, name: "ArrowUp" },
    option3: { icon: TrendingUp, name: "TrendingUp" },
    option4: { icon: Signal, name: "Signal" },
  },
  consistency: {
    option1: { icon: RefreshCw, name: "RefreshCw" },
    option2: { icon: Repeat, name: "Repeat" },
    option3: { icon: Timer, name: "Timer" },
    option4: { icon: Clock, name: "Clock" },
  },
};

// Sample badge data with final approved colors
const sampleData = {
  status: { value: "In Progress", border: "border-fuchsia-500", bg: "bg-fuchsia-500/20 text-fuchsia-400" },
  severity: { value: "Major", border: "border-amber-500", bg: "bg-amber-500/20 text-amber-500" },
  priority: { value: "High", border: "border-purple-500", bg: "bg-purple-500/20 text-purple-200" }, // Brightest
  consistency: { value: "Constant", border: "border-cyan-500", bg: "bg-cyan-500/20 text-cyan-200" }, // Brightest
};

// Border colors - Status badges match individual status colors
// Other fields use consistent border with shaded fill colors
const FIELD_BORDERS = {
  // Not used for status - each status has its own border color
  severity: "border-amber-500",
  priority: "border-purple-500", // Changed from rose to purple
  consistency: "border-cyan-500",
};

// Status-specific borders (match the status color)
const STATUS_BORDERS = {
  // New group - Cyan/Teal
  new: "border-cyan-500",
  unconfirmed: "border-cyan-600",
  confirmed: "border-teal-500",
  // In Progress group - Purple/Magenta
  diagnosing: "border-purple-400",
  diagnosed: "border-purple-500",
  in_progress: "border-fuchsia-500",
  needs_parts: "border-purple-600",
  parts_ordered: "border-purple-500",
  needs_expert: "border-pink-500",
  // Closed group - Green/Gray
  fixed: "border-green-500",
  wont_fix: "border-zinc-500",
  works_as_intended: "border-emerald-500",
  not_reproducible: "border-slate-500",
  duplicate: "border-neutral-600",
};

export default function BadgeGridMockupsPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Grid Mockups</h1>
          <p className="text-muted-foreground">
            Exploring icon options and grid layouts for displaying all 4 badge types.
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to Badge Preview
          </Link>
        </div>

        {/* Icon Options Section */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Icon Options (Pick One Per Type)
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Icons */}
            <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
              <h3 className="font-medium text-purple-400">Status Icons</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ICON_OPTIONS.status).map(([key, { icon: Icon, name }]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Icon className="size-4 text-purple-400" />
                    <span className="text-xs">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity Icons */}
            <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
              <h3 className="font-medium text-amber-400">Severity Icons</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ICON_OPTIONS.severity).map(([key, { icon: Icon, name }]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Icon className="size-4 text-amber-400" />
                    <span className="text-xs">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority Icons */}
            <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
              <h3 className="font-medium text-red-400">Priority Icons</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ICON_OPTIONS.priority).map(([key, { icon: Icon, name }]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Icon className="size-4 text-red-400" />
                    <span className="text-xs">{name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Consistency Icons */}
            <div className="space-y-3 p-4 bg-card rounded-lg border border-border">
              <h3 className="font-medium text-cyan-400">Consistency Icons</h3>
              <div className="flex flex-wrap gap-3">
                {Object.entries(ICON_OPTIONS.consistency).map(([key, { icon: Icon, name }]) => (
                  <div key={key} className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Icon className="size-4 text-cyan-400" />
                    <span className="text-xs">{name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Grid Layout Options */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Badge Grid Layouts
          </h2>

          {/* 2x2 Grid - Primary Layout */}
          <div className="space-y-3">
            <h3 className="font-medium">2x2 Grid</h3>
            <p className="text-sm text-muted-foreground">Used for: Issue lists, Dashboard cards</p>
            <div className="grid grid-cols-2 gap-2 max-w-xs p-3 bg-card rounded-lg border border-border">
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.in_progress, sampleData.status.bg)}>
                <CircleDot className="size-3" />
                {sampleData.status.value}
              </Badge>
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.severity, sampleData.severity.bg)}>
                <AlertTriangle className="size-3" />
                {sampleData.severity.value}
              </Badge>
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.priority, sampleData.priority.bg)}>
                <TrendingUp className="size-3" />
                {sampleData.priority.value}
              </Badge>
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.consistency, sampleData.consistency.bg)}>
                <Repeat className="size-3" />
                {sampleData.consistency.value}
              </Badge>
            </div>
          </div>

          {/* 1x4 Horizontal - Issue Detail */}
          <div className="space-y-3">
            <h3 className="font-medium">1x4 Horizontal Strip</h3>
            <p className="text-sm text-muted-foreground">Used for: Issue detail page (below title)</p>
            <div className="flex gap-2 p-3 bg-card rounded-lg border border-border">
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.in_progress, sampleData.status.bg)}>
                <CircleDot className="size-3" />
                {sampleData.status.value}
              </Badge>
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.severity, sampleData.severity.bg)}>
                <AlertTriangle className="size-3" />
                {sampleData.severity.value}
              </Badge>
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.priority, sampleData.priority.bg)}>
                <TrendingUp className="size-3" />
                {sampleData.priority.value}
              </Badge>
              <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.consistency, sampleData.consistency.bg)}>
                <Repeat className="size-3" />
                {sampleData.consistency.value}
              </Badge>
            </div>
          </div>
        </section>

        {/* Border Color Strategy */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Border Color Strategy
          </h2>
          <p className="text-sm text-muted-foreground">
            Status badges have individual border colors matching their status color. Other fields use a consistent border color with shaded fill colors.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status with individual borders */}
            <div className="space-y-2">
              <h3 className="font-medium text-purple-400">Status (Individual Borders)</h3>
              <p className="text-xs text-muted-foreground">Each status has its own border color. Icons vary by group.</p>
              <div className="flex flex-wrap gap-2">
                  <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.new, "bg-cyan-500/20 text-cyan-400")}>
                    <Circle className="size-3" />New
                  </Badge>
                  <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.in_progress, "bg-fuchsia-500/20 text-fuchsia-400")}>
                    <CircleDot className="size-3" />In Progress
                  </Badge>
                  <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.fixed, "bg-green-500/20 text-green-400")}>
                    <Disc className="size-3 fill-current" />Fixed (Disc)
                  </Badge>
                  <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.fixed, "bg-green-500/20 text-green-400")}>
                    <CheckCircle2 className="size-3" />Fixed (Check)
                  </Badge>
                  <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", STATUS_BORDERS.fixed, "bg-green-500/20 text-green-400")}>
                    <CircleX className="size-3" />Fixed (X)
                  </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Pick one for Closed group:</p>
            </div>

            {/* Severity with consistent border */}
            <div className="space-y-2">
              <h3 className="font-medium text-amber-400">Severity (Amber Border, Shaded Fills)</h3>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.severity, "bg-amber-200/20 text-amber-300")}>
                  <AlertTriangle className="size-3" />Cosmetic
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.severity, "bg-amber-400/20 text-amber-400")}>
                  <AlertTriangle className="size-3" />Minor
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.severity, "bg-amber-500/20 text-amber-500")}>
                  <AlertTriangle className="size-3" />Major
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.severity, "bg-amber-600/20 text-amber-600")}>
                  <AlertTriangle className="size-3" />Unplayable
                </Badge>
              </div>
            </div>

            {/* Priority with consistent border - INVERTED SHADING */}
            <div className="space-y-2">
              <h3 className="font-medium text-purple-400">Priority (Purple Border, Shaded Fills)</h3>
              <p className="text-xs text-muted-foreground">High = brightest (lightest value)</p>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.priority, "bg-purple-950/50 text-purple-600")}>
                  <TrendingUp className="size-3" />Low
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.priority, "bg-purple-900/50 text-purple-400")}>
                  <TrendingUp className="size-3" />Medium
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.priority, "bg-purple-500/20 text-purple-200")}>
                  <TrendingUp className="size-3" />High
                </Badge>
              </div>
            </div>

            {/* Consistency with consistent border - INVERTED, NO UNSURE */}
            <div className="space-y-2">
              <h3 className="font-medium text-cyan-400">Consistency (Cyan Border, Shaded Fills)</h3>
              <p className="text-xs text-muted-foreground">Constant = brightest (lightest value). Removed "Unsure".</p>
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.consistency, "bg-cyan-950/50 text-cyan-600")}>
                  <Repeat className="size-3" />Intermittent
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.consistency, "bg-cyan-900/50 text-cyan-400")}>
                  <Repeat className="size-3" />Frequent
                </Badge>
                <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2", FIELD_BORDERS.consistency, "bg-cyan-500/20 text-cyan-200")}>
                  <Repeat className="size-3" />Constant
                </Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Component Variants Preview */}
        <section className="space-y-6">
          <h2 className="text-xl font-semibold border-b border-border pb-2">
            Component Variants (Mini / Half / Normal)
          </h2>

          {/* Mini Variant */}
          <div className="space-y-3">
            <h3 className="font-medium">Mini Variant (Recent Issues Panel)</h3>
            <p className="text-sm text-muted-foreground">Status only, no icon, smallest size</p>
            <div className="max-w-xs p-3 bg-card rounded-lg border border-border space-y-1.5">
              {["Left flipper not responding", "Ball stuck in Thing's box", "Dim GI lighting"].map((title, i) => (
                <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-muted/30 rounded">
                  <span className="text-xs truncate">{title}</span>
                  <Badge className="px-1.5 py-0 text-[10px] h-4 bg-fuchsia-500/20 text-fuchsia-400 border-0">
                    In Progress
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Half Variant (Grid cards) */}
          <div className="space-y-3">
            <h3 className="font-medium">Half Variant (Dashboard Grid Cards)</h3>
            <p className="text-sm text-muted-foreground">2x2 grid with icons, compact card</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map((i) => (
                <div key={i} className="p-4 bg-card rounded-lg border border-border space-y-3">
                  <div className="space-y-1">
                    <span className="text-muted-foreground font-mono text-sm">TAF-{i}</span>
                    <h4 className="font-medium">Left flipper not responding</h4>
                    <p className="text-xs text-muted-foreground">The Addams Family</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Badge className={cn("flex items-center gap-1 px-1.5 py-0.5 text-[10px] border-2 min-w-[90px]", STATUS_BORDERS.in_progress, "bg-fuchsia-500/20 text-fuchsia-400")}>
                      <CircleDot className="size-2.5" />In Progress
                    </Badge>
                    <Badge className={cn("flex items-center gap-1 px-1.5 py-0.5 text-[10px] border-2 min-w-[90px]", FIELD_BORDERS.severity, "bg-amber-500/20 text-amber-400")}>
                      <AlertTriangle className="size-2.5" />Major
                    </Badge>
                    <Badge className={cn("flex items-center gap-1 px-1.5 py-0.5 text-[10px] border-2 min-w-[90px]", FIELD_BORDERS.priority, "bg-purple-500/20 text-purple-200")}>
                      <TrendingUp className="size-2.5" />High
                    </Badge>
                    <Badge className={cn("flex items-center gap-1 px-1.5 py-0.5 text-[10px] border-2 min-w-[90px]", FIELD_BORDERS.consistency, "bg-cyan-500/20 text-cyan-200")}>
                      <Repeat className="size-2.5" />Constant
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Normal Variant (Issue List) */}
          <div className="space-y-3">
            <h3 className="font-medium">Normal Variant (Issue List Rows)</h3>
            <p className="text-sm text-muted-foreground">Full row with badges on right side in 2x2 grid</p>
            <div className="border border-border rounded-lg overflow-hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between gap-4 p-4 border-b border-border last:border-b-0 hover:bg-muted/40">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground text-sm">TAF-{i}</span>
                      <span className="font-medium truncate">Left flipper not responding</span>
                    </div>
                    <p className="text-xs text-muted-foreground">The Addams Family • Dec 29, 2025</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 shrink-0">
                    <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px]", STATUS_BORDERS.in_progress, "bg-fuchsia-500/20 text-fuchsia-400")}>
                      <CircleDot className="size-3" />In Progress
                    </Badge>
                    <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px]", FIELD_BORDERS.severity, "bg-amber-500/20 text-amber-500")}>
                      <AlertTriangle className="size-3" />Major
                    </Badge>
                    <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px]", FIELD_BORDERS.priority, "bg-purple-500/20 text-purple-200")}>
                      <TrendingUp className="size-3" />High
                    </Badge>
                    <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px]", FIELD_BORDERS.consistency, "bg-cyan-500/20 text-cyan-200")}>
                      <Repeat className="size-3" />Constant
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
    </div>
  );
}
