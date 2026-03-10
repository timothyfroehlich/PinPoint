import type React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Wrench, Sparkles } from "lucide-react";
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

export default function CardsPage(): React.JSX.Element {
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Card Patterns</h2>
        <p className="text-muted-foreground">
          The 5 canonical card variants. Always use{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            Card / CardHeader / CardTitle / CardContent
          </code>
          . Never use raw bordered divs. Never invent new border/glow
          combinations.
        </p>
        <div className="inline-flex items-center gap-2 bg-warning-container text-on-warning-container text-xs px-3 py-1.5 rounded-lg">
          <strong>CORE-UI-008/009:</strong> Card composition + 5 canonical
          variants
        </div>
      </div>

      {/* Variant 1: Neutral */}
      <Section
        title="1. Neutral (default info card)"
        note="For static informational content. No hover, no glow."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base">Neutral Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Static informational content. No interaction implied.
              </p>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-border bg-card">
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground">Content</p>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>

      {/* Variant 2: Primary action */}
      <Section
        title="2. Primary Action (interactive / navigable)"
        note="For cards that link somewhere or trigger an action. Wrap in <Link> or add onClick."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="#">
            <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">Interactive Card</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Click me — this card navigates or triggers an action.
                </p>
              </CardContent>
            </Card>
          </Link>
          <CodeBlock>{`<Link href="/somewhere">
  <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
    <CardHeader>
      <CardTitle>Interactive Card</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">Content</p>
    </CardContent>
  </Card>
</Link>`}</CodeBlock>
        </div>
      </Section>

      {/* Variant 3: Success */}
      <Section
        title="3. Success (fixed / healthy / completed)"
        note="For machines that were fixed, completed tasks, healthy states."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-success/30 bg-success/10 glow-success">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                <CardTitle className="text-base text-success">
                  Machine Fixed
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-success/80">
                All critical issues resolved.
              </p>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-success/30 bg-success/10 glow-success">
  <CardHeader>
    <div className="flex items-center gap-2">
      <CheckCircle2 className="size-5 text-success" />
      <CardTitle className="text-base text-success">
        Machine Fixed
      </CardTitle>
    </div>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-success/80">All critical issues resolved.</p>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>

      {/* Variant 4: Warning */}
      <Section
        title="4. Warning (attention needed)"
        note="For attention-needed states, non-critical alerts, partial issues."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-warning/30 bg-warning/10 glow-warning">
            <CardHeader>
              <CardTitle className="text-base text-warning">
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-warning/80">
                Minor issues reported — not blocking play.
              </p>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-warning/30 bg-warning/10 glow-warning">
  <CardHeader>
    <CardTitle className="text-base text-warning">Needs Attention</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-warning/80">Minor issues reported.</p>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>

      {/* Variant 5: Destructive */}
      <Section
        title="5. Destructive (critical / unplayable / error)"
        note="For unplayable machines, critical errors, danger states."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-destructive/30 bg-destructive/10 glow-destructive">
            <CardHeader>
              <CardTitle className="text-base text-destructive">
                Unplayable
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive/80">
                Critical issue — machine is out of service.
              </p>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-destructive/30 bg-destructive/10 glow-destructive">
  <CardHeader>
    <CardTitle className="text-base text-destructive">Unplayable</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-destructive/80">
      Critical issue — machine is out of service.
    </p>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>

      {/* Stat card pattern */}
      <Section
        title="Stat Card Pattern"
        rule="Dashboard pattern"
        note="Used on the Dashboard for quick stats. CardTitle as label, large number in CardContent."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="#">
            <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Open Issues
                  </CardTitle>
                  <AlertTriangle className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">24</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="#">
            <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Machines Needing Service
                  </CardTitle>
                  <Wrench className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">3</div>
              </CardContent>
            </Card>
          </Link>
          <Link href="#">
            <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Assigned to Me
                  </CardTitle>
                  <CheckCircle2 className="size-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">7</div>
              </CardContent>
            </Card>
          </Link>
        </div>
        <CodeBlock>{`<Link href="/issues?status=...">
  <Card className="border-primary/20 bg-card glow-primary hover:border-primary transition-all cursor-pointer h-full">
    <CardHeader>
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Open Issues
        </CardTitle>
        <AlertTriangle className="size-4 text-muted-foreground" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-foreground">{count}</div>
    </CardContent>
  </Card>
</Link>`}</CodeBlock>
      </Section>

      {/* Empty state inside card */}
      <Section
        title="Empty State Card"
        rule="CORE-UI-010"
        note="When a list/grid has no items. Always use this pattern — never show a blank area."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">No machines yet</p>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-border bg-card">
  <CardContent className="py-12 text-center">
    <Sparkles className="mx-auto mb-4 size-12 text-muted-foreground" />
    <p className="text-lg text-muted-foreground">No machines yet</p>
    {/* Optional CTA */}
    <Button variant="outline" className="mt-4" asChild>
      <Link href="/m/new">Add a machine</Link>
    </Button>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>
    </div>
  );
}
