import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  Circle,
  CircleDot,
  Disc,
  AlertTriangle,
  TrendingUp,
  Repeat,
  Search,
  ChevronDown,
} from "lucide-react";

/**
 * Badge Dropdown Mockups (Refined)
 *
 * Compact dropdown menus and interactive trigger designs.
 */

const STATUS_OPTIONS = [
  { group: "New", options: [
    { value: "new", label: "New", icon: Circle, color: "bg-cyan-500/20 text-cyan-400 border-cyan-500" },
    { value: "unconfirmed", label: "Unconfirmed", icon: Circle, color: "bg-cyan-600/20 text-cyan-500 border-cyan-600" },
    { value: "confirmed", label: "Confirmed", icon: Circle, color: "bg-teal-500/20 text-teal-400 border-teal-500" },
  ]},
  { group: "In Progress", options: [
    { value: "diagnosing", label: "Diagnosing", icon: CircleDot, color: "bg-purple-400/20 text-purple-300 border-purple-400" },
    { value: "diagnosed", label: "Diagnosed", icon: CircleDot, color: "bg-purple-500/20 text-purple-400 border-purple-500" },
    { value: "in_progress", label: "Work in Progress", icon: CircleDot, color: "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500" },
    { value: "needs_parts", label: "Needs Parts", icon: CircleDot, color: "bg-purple-600/20 text-purple-500 border-purple-600" },
    { value: "parts_ordered", label: "Parts Ordered", icon: CircleDot, color: "bg-purple-500/20 text-purple-400 border-purple-500" },
    { value: "needs_expert", label: "Needs Expert Help", icon: CircleDot, color: "bg-pink-500/20 text-pink-400 border-pink-500" },
  ]},
  { group: "Closed", options: [
    { value: "fixed", label: "Fixed", icon: Disc, color: "bg-green-500/20 text-green-400 border-green-500" },
    { value: "works_as_intended", label: "Works as Intended", icon: Disc, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500" },
    { value: "wont_fix", label: "Won't Fix", icon: Disc, color: "bg-zinc-500/20 text-zinc-400 border-zinc-500" },
    { value: "not_reproducible", label: "Not Reproducible", icon: Disc, color: "bg-slate-500/20 text-slate-400 border-slate-500" },
    { value: "duplicate", label: "Duplicate", icon: Disc, color: "bg-neutral-600/20 text-neutral-500 border-neutral-600" },
  ]},
];

const SEVERITY_OPTIONS = [
  { value: "cosmetic", label: "Cosmetic", description: "Visual issue only", color: "bg-amber-200/20 text-amber-300" },
  { value: "minor", label: "Minor", description: "Slightly annoying", color: "bg-amber-400/20 text-amber-400" },
  { value: "major", label: "Major", description: "Significant impact", color: "bg-amber-500/20 text-amber-500" },
  { value: "unplayable", label: "Unplayable", description: "Cannot play", color: "bg-amber-600/20 text-amber-600" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", description: "Can wait", color: "bg-purple-950/50 text-purple-600" },
  { value: "medium", label: "Medium", description: "Normal priority", color: "bg-purple-900/50 text-purple-400" },
  { value: "high", label: "High", description: "Urgent", color: "bg-purple-500/20 text-purple-200" },
];

const CONSISTENCY_OPTIONS = [
  { value: "intermittent", label: "Intermittent", description: "Happens occasionally", color: "bg-cyan-950/50 text-cyan-600" },
  { value: "frequent", label: "Frequent", description: "Happens often", color: "bg-cyan-900/50 text-cyan-400" },
  { value: "constant", label: "Constant", description: "Happens every time", color: "bg-cyan-500/20 text-cyan-200" },
];

function getTextColor(colorClass: string) {
  return colorClass.split(" ").find(c => c.startsWith("text-")) || "text-foreground";
}

export default function BadgeDropdownMockupsPage(): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-12">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Badge Dropdown Mockups (Refined)</h1>
          <p className="text-muted-foreground">
            Compact dropdown menus and interactive trigger designs.
          </p>
          <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
            ← Back to Badge Preview
          </Link>
        </div>

        {/* Trigger Styles Section */}
        <section className="space-y-6 border-b border-border pb-8">
          <div>
            <h2 className="text-xl font-semibold">The "Trigger" (Issue Details)</h2>
            <p className="text-sm text-muted-foreground">
              How badges appear on the details page to indicate they are editable dropdowns.
              Using a <strong>ChevronDown</strong> icon clearly signals interactivity.
            </p>
          </div>

          <div className="p-6 bg-card border border-border rounded-lg space-y-6">
             <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">1x4 Layout with Indicators</h3>
                <div className="flex flex-wrap gap-2 items-center">
                    {/* Status Trigger */}
                    <button className="group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full">
                        <Badge className={cn("flex items-center gap-1.5 px-3 py-1 text-xs border-2 hover:bg-fuchsia-500/30 transition-colors", "border-fuchsia-500 bg-fuchsia-500/20 text-fuchsia-400")}>
                          <CircleDot className="size-3" />
                          <span>In Progress</span>
                          <ChevronDown className="size-3 ml-1 text-fuchsia-400/70 group-hover:text-fuchsia-400 transition-colors" />
                        </Badge>
                    </button>

                    {/* Severity Trigger */}
                    <button className="group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full">
                        <Badge className={cn("flex items-center gap-1.5 px-3 py-1 text-xs border-2 hover:bg-amber-500/30 transition-colors", "border-amber-500 bg-amber-500/20 text-amber-500")}>
                          <AlertTriangle className="size-3" />
                          <span>Major</span>
                          <ChevronDown className="size-3 ml-1 text-amber-500/70 group-hover:text-amber-500 transition-colors" />
                        </Badge>
                    </button>

                     {/* Priority Trigger */}
                     <button className="group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full">
                        <Badge className={cn("flex items-center gap-1.5 px-3 py-1 text-xs border-2 hover:bg-purple-500/30 transition-colors", "border-purple-500 bg-purple-500/20 text-purple-200")}>
                          <TrendingUp className="size-3" />
                          <span>High</span>
                          <ChevronDown className="size-3 ml-1 text-purple-200/70 group-hover:text-purple-200 transition-colors" />
                        </Badge>
                    </button>

                     {/* Consistency Trigger */}
                     <button className="group focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-full">
                        <Badge className={cn("flex items-center gap-1.5 px-3 py-1 text-xs border-2 hover:bg-cyan-500/30 transition-colors", "border-cyan-500 bg-cyan-500/20 text-cyan-200")}>
                          <Repeat className="size-3" />
                          <span>Constant</span>
                          <ChevronDown className="size-3 ml-1 text-cyan-200/70 group-hover:text-cyan-200 transition-colors" />
                        </Badge>
                    </button>
                </div>
             </div>
          </div>
        </section>

        {/* Status Dropdown */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Status Dropdown (Compact)</h2>
            <p className="text-sm text-muted-foreground">Text-only options with colored icons/text. No badges in list.</p>
          </div>

          <div className="max-w-xs bg-popover border border-border rounded-md shadow-md overflow-hidden">
            {/* Search Field */}
            <div className="p-2 border-b border-border">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Set status..."
                  className="pl-8 h-8 text-xs border-none bg-muted/50 focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Grouped Options */}
            <div className="py-1 max-h-[300px] overflow-y-auto">
              {STATUS_OPTIONS.map((group) => (
                <div key={group.group}>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
                    {group.group}
                  </div>
                  {group.options.map((option) => {
                    const Icon = option.icon;
                    const textColor = getTextColor(option.color);

                    return (
                      <button
                        key={option.value}
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors text-left group"
                      >
                         <Icon className={cn("size-3.5 fill-current", textColor)} />
                         <span className={cn("text-sm font-medium", textColor)}>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Severity Dropdown */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Severity Dropdown</h2>
          </div>

          <div className="max-w-xs bg-popover border border-border rounded-md shadow-md overflow-hidden">
             <div className="p-1">
              {SEVERITY_OPTIONS.map((option) => {
                 const textColor = getTextColor(option.color);
                 return (
                <button
                  key={option.value}
                  className="w-full flex items-start gap-3 px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <AlertTriangle className={cn("size-4 mt-0.5 shrink-0", textColor)} />
                  <div className="flex flex-col gap-0.5">
                      <span className={cn("text-sm font-medium leading-none", textColor)}>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </button>
              )})}
            </div>
          </div>
        </section>

        {/* Priority Dropdown */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Priority Dropdown</h2>
          </div>

          <div className="max-w-xs bg-popover border border-border rounded-md shadow-md overflow-hidden">
             <div className="p-1">
              {PRIORITY_OPTIONS.map((option) => {
                 const textColor = getTextColor(option.color);
                 return (
                <button
                  key={option.value}
                  className="w-full flex items-start gap-3 px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <TrendingUp className={cn("size-4 mt-0.5 shrink-0", textColor)} />
                  <div className="flex flex-col gap-0.5">
                      <span className={cn("text-sm font-medium leading-none", textColor)}>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </button>
              )})}
            </div>
          </div>
        </section>

        {/* Consistency Dropdown */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Consistency Dropdown</h2>
          </div>

          <div className="max-w-xs bg-popover border border-border rounded-md shadow-md overflow-hidden">
             <div className="p-1">
              {CONSISTENCY_OPTIONS.map((option) => {
                 const textColor = getTextColor(option.color);
                 return (
                <button
                  key={option.value}
                  className="w-full flex items-start gap-3 px-3 py-2 rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                >
                  <Repeat className={cn("size-4 mt-0.5 shrink-0", textColor)} />
                  <div className="flex flex-col gap-0.5">
                      <span className={cn("text-sm font-medium leading-none", textColor)}>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                  </div>
                </button>
              )})}
            </div>
          </div>
        </section>
      </div>
    </div>
    </div>
  );
}
