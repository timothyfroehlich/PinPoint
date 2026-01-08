import type React from "react";
import Link from "next/link";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import {
  AlertTriangle,
  TrendingUp,
  Repeat,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  ArrowUpDown,
  Gamepad2,
  Check,
  MoreHorizontal,
  Plus,
  Circle,
  CircleDot,
  Disc,
} from "lucide-react";

/**
 * Filter Mockups - Iteration 3
 *
 * 3-Row Layout:
 * Row 1: Search box with embedded filter pills (shares space)
 * Row 2: Prominent game filter (2-3 max-width pills)
 * Row 3: Pagination + Sort (GitHub-style, right-aligned)
 */

const SAMPLE_MACHINES = [
  { initials: "TAF", name: "The Addams Family", issueCount: 4 },
  { initials: "AFM", name: "Attack from Mars", issueCount: 2 },
  { initials: "MM", name: "Medieval Madness", issueCount: 1 },
  { initials: "TZ", name: "Twilight Zone", issueCount: 3 },
  { initials: "WH2O", name: "White Water", issueCount: 0 },
  { initials: "TSPP", name: "The Simpsons Pinball Party", issueCount: 2 },
];

export default function FilterMockupsV3Page(): React.JSX.Element {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="min-h-screen p-8">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold">Filter Mockups (v3)</h1>
            <p className="text-muted-foreground">
              3-row layout: Search+Filters, Games, Pagination/Sort.
            </p>
            <Link href="/dev/badge-preview" className="text-primary hover:underline text-sm">
              ← Back to Badge Preview
            </Link>
          </div>

          {/* ========================================
              MAIN DESIGN - 3 Row Layout
              ======================================== */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Desktop: 3-Row Layout</h2>

            <div className="max-w-4xl bg-card border border-border rounded-lg overflow-hidden">

              {/* ROW 1: Search Box with Embedded Filter Pills */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2">
                  {/* Search Input with Pills Inside */}
                  <div className="flex-1 flex items-center flex-wrap gap-1.5 px-3 py-1.5 min-h-[40px] border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <Search className="size-4 text-muted-foreground shrink-0" />

                    {/* Embedded Filter Pills (max 3) */}
                    <Badge className="flex items-center gap-1 px-1.5 py-0 h-6 text-xs bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/50 rounded shrink-0">
                      <CircleDot className="size-3" />
                      Open
                      <button className="hover:bg-fuchsia-500/30 rounded p-0.5 -mr-0.5">
                        <X className="size-2.5" />
                      </button>
                    </Badge>

                    <Badge className="flex items-center gap-1 px-1.5 py-0 h-6 text-xs bg-purple-500/20 text-purple-200 border border-purple-500/50 rounded shrink-0">
                      <TrendingUp className="size-3" />
                      High
                      <button className="hover:bg-purple-500/30 rounded p-0.5 -mr-0.5">
                        <X className="size-2.5" />
                      </button>
                    </Badge>

                    <Badge className="flex items-center gap-1 px-1.5 py-0 h-6 text-xs bg-zinc-500/20 text-zinc-400 border border-zinc-500/50 rounded shrink-0">
                      <User className="size-3" />
                      Me
                      <button className="hover:bg-zinc-500/30 rounded p-0.5 -mr-0.5">
                        <X className="size-2.5" />
                      </button>
                    </Badge>

                    {/* Overflow indicator */}
                    <button className="flex items-center gap-0.5 px-1.5 h-6 text-xs bg-muted/50 text-muted-foreground border border-input rounded hover:bg-muted shrink-0">
                      +2
                      <ChevronDown className="size-2.5" />
                    </button>

                    {/* Search Input (expands to fill remaining space) */}
                    <input
                      type="text"
                      placeholder="Search issues..."
                      className="flex-1 min-w-[25ch] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                    />

                    {/* Clear */}
                    <button className="text-xs text-muted-foreground hover:text-foreground shrink-0">
                      Clear
                    </button>
                  </div>

                  {/* Filter Buttons (collapse into More when tight) */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Status - Always visible */}
                    <button className="flex items-center gap-1 h-9 px-2.5 border border-input rounded-md text-xs hover:bg-muted/50">
                      <CircleDot className="size-3.5 text-fuchsia-500" />
                      Status
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </button>

                    {/* Priority - Visible if space */}
                    <button className="flex items-center gap-1 h-9 px-2.5 border border-input rounded-md text-xs hover:bg-muted/50">
                      <TrendingUp className="size-3.5 text-purple-500" />
                      Priority
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </button>

                    {/* Assignee - Visible if space */}
                    <button className="flex items-center gap-1 h-9 px-2.5 border border-input rounded-md text-xs hover:bg-muted/50">
                      <User className="size-3.5" />
                      Assignee
                      <ChevronDown className="size-3 text-muted-foreground" />
                    </button>

                    {/* More (Severity, Consistency, Owner) */}
                    <button className="flex items-center gap-1 h-9 px-2.5 border border-dashed border-input rounded-md text-xs hover:bg-muted/50 text-muted-foreground">
                      <MoreHorizontal className="size-3.5" />
                      More
                      <ChevronDown className="size-3" />
                    </button>
                  </div>
                </div>
              </div>

              {/* ROW 2: Prominent Game Filter */}
              <div className="p-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Gamepad2 className="size-5 text-primary shrink-0" />

                  {/* Game Pills (2-3 based on space) */}
                  <div className="flex items-center gap-1.5">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">
                      <span className="font-mono font-bold">TAF</span>
                      <span className="text-xs opacity-80">4</span>
                      <X className="size-3 opacity-70 hover:opacity-100" />
                    </button>

                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-muted/80 text-foreground border border-input">
                      <span className="font-mono font-bold">AFM</span>
                      <span className="text-xs text-muted-foreground">2</span>
                    </button>

                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted hover:bg-muted/80 text-foreground border border-input">
                      <span className="font-mono font-bold">MM</span>
                      <span className="text-xs text-muted-foreground">1</span>
                    </button>

                    {/* Add more games */}
                    <button className="flex items-center gap-1 px-2 py-1.5 text-sm rounded-md border border-dashed border-input hover:bg-muted text-muted-foreground">
                      <Plus className="size-3.5" />
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>

                  <div className="flex-1" />

                  {/* Quick: All / Selected only toggle */}
                  <div className="flex items-center text-xs text-muted-foreground gap-2">
                    <button className="hover:text-foreground">All machines</button>
                    <span>•</span>
                    <button className="text-primary font-medium">Selected (2)</button>
                  </div>
                </div>
              </div>

              {/* ROW 3: Pagination + Sort (GitHub-style) */}
              <div className="p-3 flex items-center justify-between">
                <div className="flex-1" /> {/* Breathing room */}

                <div className="flex items-center gap-4">
                  {/* Sort */}
                  <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowUpDown className="size-3.5" />
                    Sort: <span className="text-foreground">Newest</span>
                    <ChevronDown className="size-3.5" />
                  </button>

                  {/* Pagination */}
                  <div className="flex items-center gap-1">
                    <button className="size-8 flex items-center justify-center rounded hover:bg-muted text-muted-foreground">
                      <ChevronLeft className="size-4" />
                    </button>
                    <span className="text-sm text-muted-foreground px-2">
                      <span className="text-foreground font-medium">1-25</span> of 47
                    </span>
                    <button className="size-8 flex items-center justify-center rounded hover:bg-muted">
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================
              STATUS DROPDOWN IDEAS
              ======================================== */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Status Filter Ideas</h2>
            <p className="text-sm text-muted-foreground">Supporting grouped status selection.</p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Idea A: Quick tabs + Detailed dropdown */}
              <div className="space-y-2">
                <h3 className="font-medium">Idea A: Quick Tabs + Detailed Filter</h3>
                <div className="p-4 bg-card border border-border rounded-lg space-y-3">
                  {/* Quick tabs */}
                  <div className="flex items-center rounded-md border border-input p-0.5 w-fit">
                    <button className="h-7 px-3 text-xs rounded-sm text-muted-foreground hover:bg-muted/50 flex items-center gap-1">
                      <Circle className="size-3 text-cyan-500" />
                      New
                    </button>
                    <button className="h-7 px-3 text-xs rounded-sm bg-secondary text-secondary-foreground flex items-center gap-1">
                      <CircleDot className="size-3 text-fuchsia-500" />
                      Open
                    </button>
                    <button className="h-7 px-3 text-xs rounded-sm text-muted-foreground hover:bg-muted/50 flex items-center gap-1">
                      <Disc className="size-3 text-zinc-500" />
                      Closed
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Quick tabs for groups. Status dropdown shows individual statuses within selected group.
                  </p>
                </div>
              </div>

              {/* Idea B: Combined multiselect by group */}
              <div className="space-y-2">
                <h3 className="font-medium">Idea B: Grouped Multiselect</h3>
                <div className="max-w-xs bg-popover border border-border rounded-md shadow-md overflow-hidden">
                  <div className="p-1">
                    {/* New group */}
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-accent text-left">
                      <div className="size-4 border rounded flex items-center justify-center bg-primary border-primary">
                        <Check className="size-3 text-primary-foreground" />
                      </div>
                      <Circle className="size-3.5 text-cyan-500 fill-cyan-500" />
                      <span className="text-sm font-medium">All New</span>
                      <span className="text-xs text-muted-foreground ml-auto">3 statuses</span>
                    </button>

                    {/* In Progress group */}
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-accent text-left">
                      <div className="size-4 border border-input rounded" />
                      <CircleDot className="size-3.5 text-fuchsia-500" />
                      <span className="text-sm font-medium">All In Progress</span>
                      <span className="text-xs text-muted-foreground ml-auto">6 statuses</span>
                    </button>

                    {/* Closed group */}
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 rounded-sm hover:bg-accent text-left">
                      <div className="size-4 border border-input rounded" />
                      <Disc className="size-3.5 text-zinc-500 fill-zinc-500" />
                      <span className="text-sm font-medium">All Closed</span>
                      <span className="text-xs text-muted-foreground ml-auto">5 statuses</span>
                    </button>
                  </div>
                  <div className="p-2 border-t border-border">
                    <button className="text-xs text-primary">Show individual statuses →</button>
                  </div>
                </div>
              </div>

              {/* Idea C: Flat with group headers */}
              <div className="space-y-2">
                <h3 className="font-medium">Idea C: Flat List with Group Headers</h3>
                <div className="max-w-xs bg-popover border border-border rounded-md shadow-md overflow-hidden">
                  <div className="p-1 max-h-[200px] overflow-y-auto">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      New
                    </div>
                    <button className="w-full flex items-center gap-2 px-3 py-1 rounded-sm hover:bg-accent text-left">
                      <div className="size-4 border border-input rounded" />
                      <span className="text-sm text-cyan-400">New</span>
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-1 rounded-sm hover:bg-accent text-left">
                      <div className="size-4 border border-input rounded" />
                      <span className="text-sm text-cyan-500">Unconfirmed</span>
                    </button>

                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                      In Progress
                    </div>
                    <button className="w-full flex items-center gap-2 px-3 py-1 rounded-sm hover:bg-accent text-left bg-accent">
                      <div className="size-4 border rounded flex items-center justify-center bg-primary border-primary">
                        <Check className="size-3 text-primary-foreground" />
                      </div>
                      <span className="text-sm text-fuchsia-400">Work in Progress</span>
                    </button>
                    <button className="w-full flex items-center gap-2 px-3 py-1 rounded-sm hover:bg-accent text-left">
                      <div className="size-4 border border-input rounded" />
                      <span className="text-sm text-purple-400">Needs Parts</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ========================================
              COLLAPSED STATE (narrow width)
              ======================================== */}
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Collapsed State (Narrow Width)</h2>
            <p className="text-sm text-muted-foreground">
              When width is constrained, filter buttons collapse into "More".
            </p>

            <div className="max-w-xl bg-card border border-border rounded-lg overflow-hidden">
              {/* Row 1 - Collapsed */}
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center flex-wrap gap-1.5 px-3 py-1.5 min-h-[40px] border border-input rounded-md bg-background">
                    <Search className="size-4 text-muted-foreground shrink-0" />

                    <Badge className="flex items-center gap-1 px-1.5 py-0 h-6 text-xs bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/50 rounded shrink-0">
                      Open
                      <X className="size-2.5" />
                    </Badge>

                    <input
                      type="text"
                      placeholder="Search..."
                      className="flex-1 min-w-[15ch] bg-transparent outline-none text-sm"
                    />

                    <button className="text-xs text-muted-foreground">Clear</button>
                  </div>

                  {/* Only Status + More visible */}
                  <button className="flex items-center gap-1 h-9 px-2.5 border border-input rounded-md text-xs hover:bg-muted/50 shrink-0">
                    <CircleDot className="size-3.5 text-fuchsia-500" />
                    Status
                    <ChevronDown className="size-3" />
                  </button>

                  <button className="flex items-center gap-1 h-9 px-2.5 border border-input rounded-md text-xs hover:bg-muted/50 shrink-0">
                    <MoreHorizontal className="size-3.5" />
                    More
                    <Badge className="bg-primary text-primary-foreground px-1 py-0 text-[10px] rounded-full">3</Badge>
                    <ChevronDown className="size-3" />
                  </button>
                </div>
              </div>

              {/* Row 2 - Games (2 pills) */}
              <div className="p-3 border-b border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Gamepad2 className="size-5 text-primary shrink-0" />
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground">
                    <span className="font-mono font-bold">TAF</span>
                    <span className="text-xs opacity-80">4</span>
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-muted border border-input">
                    <span className="font-mono font-bold">AFM</span>
                    <span className="text-xs text-muted-foreground">2</span>
                  </button>
                  <button className="flex items-center gap-1 px-2 py-1.5 text-sm rounded-md border border-dashed border-input text-muted-foreground">
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 3 */}
              <div className="p-3 flex justify-end">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-foreground">
                    <ArrowUpDown className="size-3.5" />
                    Newest
                  </button>
                  <span>1-25 of 47</span>
                </div>
              </div>
            </div>
          </section>

          {/* Design Notes */}
          <section className="space-y-4 border-t border-border pt-8">
            <h2 className="text-xl font-semibold">Design Notes</h2>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Search box shares space with filter pills (pills inside the box)</li>
              <li>Input has <code>min-w-[25ch]</code> for 25 characters</li>
              <li>Max 3 pills visible, overflow as "+N" dropdown</li>
              <li>Filter priority: Status → Priority → Assignee → (More: Severity, Consistency, Owner)</li>
              <li>Filters collapse into "More" when narrow, not wrap to new line</li>
              <li>Games row: 2-3 pills based on width, + button for more</li>
              <li>Pagination + Sort on row 3, right-aligned (GitHub-style)</li>
              <li>Game filters don't appear as pills in search box</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
