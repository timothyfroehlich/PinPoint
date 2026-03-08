import type React from "react";
import { CheckCircle2, AlertCircle, Inbox } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";
import Link from "next/link";

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

export default function StatesPage(): React.JSX.Element {
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">States</h2>
        <p className="text-muted-foreground">
          Every list, table, and grid needs an empty state. Every data fetch
          needs a loading state. These patterns ensure consistent UX across all
          pages.
        </p>
      </div>

      {/* Empty state — basic */}
      <Section
        title="Empty State — Basic"
        rule="CORE-UI-010"
        note="The standard empty state: centered icon (size-12, muted) + message (text-lg, muted). No blank screens."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <Inbox className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">No issues yet</p>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-border bg-card">
  <CardContent className="py-12 text-center">
    <Inbox className="mx-auto mb-4 size-12 text-muted-foreground" />
    <p className="text-lg text-muted-foreground">No issues yet</p>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>

      {/* Empty state — with CTA */}
      <Section
        title="Empty State — With CTA"
        note="When the user can take action to populate the list, add an optional CTA button."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-border bg-card">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">
                No machines added yet
              </p>
              <Button variant="outline" className="mt-4" asChild>
                <Link href="#">Add a machine</Link>
              </Button>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-border bg-card">
  <CardContent className="py-12 text-center">
    <CheckCircle2 className="mx-auto mb-4 size-12 text-muted-foreground" />
    <p className="text-lg text-muted-foreground">No machines added yet</p>
    <Button variant="outline" className="mt-4" asChild>
      <Link href="/m/new">Add a machine</Link>
    </Button>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>

      {/* Skeleton loading */}
      <Section
        title="Skeleton Loading"
        rule="CORE-UI-014"
        note="Match skeleton shape to the actual content. No spinners. Skeleton preserves layout stability."
      >
        <div className="space-y-6">
          {/* Issue row skeleton */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">
              Issue list row skeleton
            </p>
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card"
                >
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </div>

          {/* Stat card skeleton */}
          <div className="space-y-2">
            <p className="text-xs font-mono text-muted-foreground">
              Stat card skeleton
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="border-border bg-card">
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <CodeBlock>{`import { Skeleton } from "~/components/ui/skeleton";

// Issue row skeleton
function IssueRowSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-card">
      <Skeleton className="h-5 w-20 rounded-full" />  {/* badge */}
      <Skeleton className="h-4 flex-1" />              {/* title */}
      <Skeleton className="h-4 w-16" />               {/* assignee */}
      <Skeleton className="h-4 w-24" />               {/* date */}
    </div>
  );
}

// Stat card skeleton
function StatCardSkeleton() {
  return (
    <Card className="border-border bg-card">
      <div className="p-6 space-y-3">
        <Skeleton className="h-4 w-24" />  {/* label */}
        <Skeleton className="h-8 w-16" />  {/* number */}
      </div>
    </Card>
  );
}

// ❌ WRONG — spinner tells user nothing about content shape
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />

// ❌ WRONG — text-only loading
<p className="text-muted-foreground">Loading...</p>`}</CodeBlock>
        </div>
      </Section>

      {/* Error state */}
      <Section
        title="Error State"
        note="For when a data fetch fails. Show what went wrong and offer a retry or fallback action."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-destructive/30 bg-destructive/10">
            <CardContent className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 size-12 text-destructive" />
              <p className="text-lg text-destructive">Failed to load issues</p>
              <p className="text-sm text-muted-foreground mt-2">
                An error occurred while fetching data.
              </p>
              <Button variant="outline" className="mt-4">
                Try again
              </Button>
            </CardContent>
          </Card>
          <CodeBlock>{`<Card className="border-destructive/30 bg-destructive/10">
  <CardContent className="py-12 text-center">
    <AlertCircle className="mx-auto mb-4 size-12 text-destructive" />
    <p className="text-lg text-destructive">Failed to load issues</p>
    <p className="text-sm text-muted-foreground mt-2">
      An error occurred while fetching data.
    </p>
    <Button variant="outline" className="mt-4">
      Try again
    </Button>
  </CardContent>
</Card>`}</CodeBlock>
        </div>
      </Section>
    </div>
  );
}
