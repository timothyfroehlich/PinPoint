import {
  Circle,
  CircleDot,
  Disc,
  AlertTriangle,
  TrendingUp,
  Repeat,
  Gauge,
  Clock,
  ThumbsUp,
  Zap,
  Flame,
  Signal,
  ArrowUp,
  RefreshCw,
  Timer
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

// -----------------------------------------------------------------------------
// Data & Config (Matching Grid Mockups Page)
// -----------------------------------------------------------------------------

const STATUS_GROUPS = [
  {
    id: "new",
    label: "New Issues",
    color: "cyan",
    description: "Just reported or being verified",
    icon: Circle,
    items: [
      { id: "new", label: "New", desc: "Just reported, needs triage" },
      { id: "confirmed", label: "Confirmed", desc: "Verified as a real issue" },
    ]
  },
  {
    id: "in_progress",
    label: "In Progress",
    color: "fuchsia",
    description: "Active work is ongoing",
    icon: CircleDot,
    items: [
      { id: "waiting_on_owner", label: "Waiting on Owner", desc: "Blocked on machine owner decision/action" },
      { id: "in_progress", label: "Work in Progress", desc: "Active repair underway" },
      { id: "needs_parts", label: "Needs Parts", desc: "Waiting on new parts" },
      { id: "needs_expert", label: "Needs Expert Help", desc: "Escalated to expert" },
    ]
  },
  {
    id: "closed",
    label: "Closed",
    color: "emerald",
    description: "Resolved or rejected",
    icon: Disc,
    items: [
      { id: "fixed", label: "Fixed", desc: "Issue is resolved", specialColor: "emerald" },
      { id: "works_as_intended", label: "Works as Intended", desc: "Not a bug, it's a feature", specialColor: "emerald" },
      { id: "wont_fix", label: "Won't Fix", desc: "Too minor or risky to fix", specialColor: "zinc" },
      { id: "not_reproducible", label: "Not Reproducible", desc: "Couldn't make it happen again", specialColor: "zinc" },
      { id: "duplicate", label: "Duplicate", desc: "Already reported elsewhere", specialColor: "zinc" },
    ]
  },
];

const SEVERITY_LEVELS = [
  { id: "cosmetic", label: "Cosmetic", desc: "Visual only, doesn't affect play", intensity: "bg-amber-200/20 text-amber-300 border-amber-500", icon: AlertTriangle },
  { id: "minor", label: "Minor", desc: "Annoying but playable", intensity: "bg-amber-400/20 text-amber-400 border-amber-500", icon: AlertTriangle },
  { id: "major", label: "Major", desc: "Significant impact on gameplay", intensity: "bg-amber-500/20 text-amber-500 border-amber-500", icon: AlertTriangle },
  { id: "unplayable", label: "Unplayable", desc: "Machine cannot be played", intensity: "bg-amber-600/20 text-amber-600 border-amber-500", icon: AlertTriangle },
];

const PRIORITY_LEVELS = [
  { id: "low", label: "Low", desc: "Can wait", intensity: "bg-purple-950/50 text-purple-600 border-purple-500", icon: TrendingUp },
  { id: "medium", label: "Medium", desc: "Normal priority", intensity: "bg-purple-900/50 text-purple-400 border-purple-500", icon: TrendingUp },
  { id: "high", label: "High", desc: "Urgent/Immediate", intensity: "bg-purple-500/20 text-purple-200 border-purple-500", icon: TrendingUp },
];

const CONSISTENCY_LEVELS = [
  { id: "intermittent", label: "Intermittent", desc: "Happens occasionally", intensity: "bg-cyan-950/50 text-cyan-600 border-cyan-500", icon: Repeat },
  { id: "frequent", label: "Frequent", desc: "Happens often", intensity: "bg-cyan-900/50 text-cyan-400 border-cyan-500", icon: Repeat },
  { id: "constant", label: "Constant", desc: "Happens every time", intensity: "bg-cyan-500/20 text-cyan-200 border-cyan-500", icon: Repeat },
];

// -----------------------------------------------------------------------------
// Approved Presentation Components
// -----------------------------------------------------------------------------

function Hero() {
  return (
    <div className="text-center py-16 space-y-4 max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium mb-4">
        ✨ Approved Design
      </div>
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Issue Status Redesign
      </h1>
      <p className="text-lg text-muted-foreground leading-relaxed">
        Standardizing how we track machine issues with four key dimensions.
      </p>
    </div>
  );
}

function Section({ title, subtitle, children, className }: { title: string, subtitle?: string, children: React.ReactNode, className?: string }) {
  return (
    <section className={cn("py-12 border-t border-border", className)}>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">{title}</h2>
        {subtitle && <p className="text-muted-foreground mt-2 text-lg">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

// Re-usable 2x2 Grid Badge (Exact implementation from grid-mockups)
function BadgeGrid2x2({
  status = "In Progress",
  severity = "Major",
  priority = "High",
  consistency = "Constant"
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 shrink-0">
      <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px] bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500")}>
        <CircleDot className="size-3" />{status}
      </Badge>
      <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px] bg-amber-500/20 text-amber-500 border-amber-500")}>
        <AlertTriangle className="size-3" />{severity}
      </Badge>
      <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px] bg-purple-500/20 text-purple-200 border-purple-500")}>
        <TrendingUp className="size-3" />{priority}
      </Badge>
      <Badge className={cn("flex items-center gap-1 px-2 py-0.5 text-xs border-2 min-w-[110px] bg-cyan-500/20 text-cyan-200 border-cyan-500")}>
        <Repeat className="size-3" />{consistency}
      </Badge>
    </div>
  );
}

// Re-usable 1x4 Strip Badge (Exact implementation from grid-mockups)
function BadgeStrip1x4({
  status = "In Progress",
  severity = "Major",
  priority = "High",
  consistency = "Constant"
}) {
  return (
    <div className="flex gap-2">
      <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2 bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500")}>
        <CircleDot className="size-3" />{status}
      </Badge>
      <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2 bg-amber-500/20 text-amber-500 border-amber-500")}>
        <AlertTriangle className="size-3" />{severity}
      </Badge>
      <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2 bg-purple-500/20 text-purple-200 border-purple-500")}>
        <TrendingUp className="size-3" />{priority}
      </Badge>
      <Badge className={cn("flex items-center gap-1.5 px-2 py-1 text-xs border-2 bg-cyan-500/20 text-cyan-200 border-cyan-500")}>
        <Repeat className="size-3" />{consistency}
      </Badge>
    </div>
  );
}

export default function PresentationPage() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="max-w-5xl mx-auto px-6 pb-24">

        <Hero />

        {/* ---------------------------------------------------------------------------
            COMPLETE BREAKDOWN - ALL VALUES WITH DESCRIPTIONS
           --------------------------------------------------------------------------- */}
        <Section
          title="Complete Field Reference"
          subtitle="Every possible value with its meaning."
        >
          {/* STATUS - Full breakdown by group */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <CircleDot className="w-5 h-5 text-purple-400" />
              Status (14 values in 3 groups)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STATUS_GROUPS.map(group => {
                const groupStyles = group.id === 'new'
                  ? "border-cyan-500/50 bg-cyan-500/5"
                  : group.id === 'in_progress'
                  ? "border-fuchsia-500/50 bg-fuchsia-500/5"
                  : "border-emerald-500/50 bg-emerald-500/5";
                const headerStyles = group.id === 'new'
                  ? "text-cyan-400"
                  : group.id === 'in_progress'
                  ? "text-fuchsia-400"
                  : "text-emerald-400";

                return (
                  <div key={group.id} className={cn("rounded-lg border p-4", groupStyles)}>
                    <div className="flex items-center gap-2 mb-3">
                      <group.icon className={cn("w-4 h-4", headerStyles)} />
                      <h4 className={cn("font-bold", headerStyles)}>{group.label}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{group.description}</p>
                    <div className="space-y-3">
                      {group.items.map(item => {
                        const badgeColor = item.specialColor === 'emerald'
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500"
                          : item.specialColor === 'zinc'
                          ? "bg-zinc-500/20 text-zinc-400 border-zinc-500"
                          : group.id === 'new'
                          ? "bg-cyan-500/20 text-cyan-400 border-cyan-500"
                          : "bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500";
                        return (
                          <div key={item.id} className="flex items-start gap-2">
                            <Badge className={cn("shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] border", badgeColor)}>
                              <group.icon className="w-2 h-2" />
                              {item.label}
                            </Badge>
                            <span className="text-sm text-muted-foreground">{item.desc}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SEVERITY */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              Severity (4 values)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">How badly does the issue affect gameplay? <span className="text-primary">(Public can set this)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SEVERITY_LEVELS.map(s => (
                <div key={s.id} className="flex items-start gap-2 p-3 rounded-lg bg-card border border-border">
                  <Badge className={cn("shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] border", s.intensity)}>
                    <s.icon className="w-2 h-2" />
                    {s.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PRIORITY */}
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Priority (3 values)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">How urgent is the fix? <span className="text-primary">(Members only)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PRIORITY_LEVELS.map(p => (
                <div key={p.id} className="flex items-start gap-2 p-3 rounded-lg bg-card border border-border">
                  <Badge className={cn("shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] border", p.intensity)}>
                    <p.icon className="w-2 h-2" />
                    {p.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{p.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CONSISTENCY */}
          <div>
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-cyan-400" />
              Consistency (3 values)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">How often does the issue occur? <span className="text-primary">(Public can set this)</span></p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {CONSISTENCY_LEVELS.map(c => (
                <div key={c.id} className="flex items-start gap-2 p-3 rounded-lg bg-card border border-border">
                  <Badge className={cn("shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] border", c.intensity)}>
                    <c.icon className="w-2 h-2" />
                    {c.label}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{c.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------------------
            THE 4 DIMENSIONS (Using real badge styles)
           --------------------------------------------------------------------------- */}
        <Section
          title="The 4 Dimensions (Visual Spec)"
          subtitle="Exact styles as defined in the implementation plan."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">

            {/* STATUS */}
            <div className="space-y-4">
              <div>
                <h3 className="font-bold flex items-center gap-2 text-lg mb-1">
                  <div className="p-1.5 bg-purple-100 rounded text-purple-600"><CircleDot className="w-4 h-4" /></div>
                  Status
                </h3>
                <p className="text-sm text-muted-foreground">Lifecycle state</p>
              </div>
              <div className="space-y-2">
                <Badge className="w-full justify-start gap-2 border-2 bg-cyan-500/20 text-cyan-600 border-cyan-500"><Circle className="w-3 h-3"/> New</Badge>
                <Badge className="w-full justify-start gap-2 border-2 bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500"><CircleDot className="w-3 h-3"/> In Progress</Badge>
                <Badge className="w-full justify-start gap-2 border-2 bg-green-500/20 text-green-500 border-green-500"><Disc className="w-3 h-3"/> Fixed</Badge>
              </div>
            </div>

            {/* SEVERITY */}
            <div className="space-y-4">
              <div>
                <h3 className="font-bold flex items-center gap-2 text-lg mb-1">
                  <div className="p-1.5 bg-amber-100 rounded text-amber-600"><AlertTriangle className="w-4 h-4" /></div>
                  Severity
                </h3>
                <p className="text-sm text-muted-foreground">Gameplay impact</p>
              </div>
              <div className="space-y-2">
                {SEVERITY_LEVELS.map(s => (
                  <Badge key={s.id} className={cn("w-full justify-start gap-2 border-2", s.intensity)}>
                    <s.icon className="w-3 h-3" /> {s.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* PRIORITY */}
            <div className="space-y-4">
               <div>
                <h3 className="font-bold flex items-center gap-2 text-lg mb-1">
                  <div className="p-1.5 bg-purple-100 rounded text-purple-600"><TrendingUp className="w-4 h-4" /></div>
                  Priority
                </h3>
                <p className="text-sm text-muted-foreground">Work urgency</p>
              </div>
              <div className="space-y-2">
                {PRIORITY_LEVELS.map(p => (
                  <Badge key={p.id} className={cn("w-full justify-start gap-2 border-2", p.intensity)}>
                    <p.icon className="w-3 h-3" /> {p.label}
                  </Badge>
                ))}
              </div>
            </div>

             {/* CONSISTENCY */}
             <div className="space-y-4">
               <div>
                <h3 className="font-bold flex items-center gap-2 text-lg mb-1">
                  <div className="p-1.5 bg-cyan-100 rounded text-cyan-600"><Repeat className="w-4 h-4" /></div>
                  Consistency
                </h3>
                <p className="text-sm text-muted-foreground">Reproducibility</p>
              </div>
              <div className="space-y-2">
                {CONSISTENCY_LEVELS.map(c => (
                   <Badge key={c.id} className={cn("w-full justify-start gap-2 border-2", c.intensity)}>
                    <c.icon className="w-3 h-3" /> {c.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------------------
            APPROVED LAYOUTS
           --------------------------------------------------------------------------- */}
        <Section title="Approved Layouts" subtitle="Standardized layouts for consistency across the app.">

          <div className="grid gap-12">

            {/* 1x4 Strip */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold bg-muted inline-block px-3 py-1 rounded">1x4 Horizontal Strip</h3>
              <p className="text-muted-foreground mb-4">Used on the Issue Detail page below the title.</p>

              <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                <div className="flex flex-col gap-2">
                  <h1 className="text-2xl font-bold">Right flipper weak on The Addams Family</h1>
                  <BadgeStrip1x4 />
                </div>
              </div>
            </div>

            {/* 2x2 Grid */}
             <div className="space-y-4">
              <h3 className="text-lg font-semibold bg-muted inline-block px-3 py-1 rounded">2x2 Grid</h3>
              <p className="text-muted-foreground mb-4">Used for condensed lists (Dashboard, Issue Feeds).</p>

              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden max-w-2xl">
                <div className="bg-muted/50 px-4 py-3 border-b border-border font-medium text-muted-foreground">
                  Recent Issues
                </div>
                <div className="divide-y divide-border">
                  {[1, 2].map(i => (
                    <div key={i} className="p-4 flex items-start justify-between gap-4 hover:bg-muted/30 transition-colors">
                      <div>
                        <div className="font-bold">Right flipper weak</div>
                        <div className="text-sm text-muted-foreground mt-1">TAF-{i} • Reported 2h ago</div>
                      </div>
                      <BadgeGrid2x2 />
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </Section>

      </div>
    </div>
  );
}
