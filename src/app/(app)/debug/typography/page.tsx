import type React from "react";
import { Separator } from "~/components/ui/separator";

function CodeBlock({ children }: { children: string }): React.JSX.Element {
  return (
    <pre className="text-xs bg-muted border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Row({
  label,
  children,
  code,
  note,
}: {
  label: string;
  children: React.ReactNode;
  code: string;
  note?: string;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-6 border-b border-border last:border-0">
      <div className="space-y-3">
        <p className="text-xs font-mono text-muted-foreground">{label}</p>
        {children}
        {note && <p className="text-xs text-warning">{note}</p>}
      </div>
      <CodeBlock>{code}</CodeBlock>
    </div>
  );
}

export default function TypographyPage(): React.JSX.Element {
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Typography</h2>
        <p className="text-muted-foreground">
          Heading hierarchy, text styles, and the section heading pattern. The{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            @layer base
          </code>{" "}
          styles apply to rich text / MDX content. App pages use the section
          heading pattern (CORE-UI-007).
        </p>
      </div>

      {/* Base layer headings */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-foreground">
            Base Layer Headings
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            @layer base — for rich text / MDX only
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          These are the default styles applied by{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            globals.css
          </code>{" "}
          to bare heading elements. They are used in MDX help docs, terms,
          privacy pages. In app pages, always override with explicit font sizes.
        </p>

        <Row
          label="h1 — Page title (text-4xl lg:text-5xl font-extrabold tracking-tight)"
          code={`<h1>Page Title</h1>
// From @layer base: text-4xl lg:text-5xl font-extrabold tracking-tight`}
        >
          <h1>Page Title</h1>
        </Row>

        <Row
          label="h2 — Major section (text-3xl font-semibold tracking-tight)"
          code={`<h2>Section Heading</h2>
// From @layer base: text-3xl font-semibold tracking-tight
// ⚠️ DO NOT use bare <h2> in app pages — it's too large for in-page sections`}
          note="⚠️ Bare <h2> in app pages will look too large. Use the section heading pattern below."
        >
          <h2>Section Heading</h2>
        </Row>

        <Row
          label="h3 — Sub-section (text-2xl font-semibold tracking-tight)"
          code={`<h3>Sub-Section</h3>
// From @layer base: text-2xl font-semibold tracking-tight`}
        >
          <h3>Sub-Section</h3>
        </Row>

        <Row
          label="h4 — Minor heading (text-xl font-semibold tracking-tight)"
          code={`<h4>Minor Heading</h4>
// From @layer base: text-xl font-semibold tracking-tight`}
        >
          <h4>Minor Heading</h4>
        </Row>
      </section>

      <Separator />

      {/* App page section heading pattern */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-foreground">
            App Page Section Headings
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            CORE-UI-007 — the established pattern
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          App pages override the base heading styles explicitly. This is the
          pattern used on Dashboard, Issues, Machines, etc.
        </p>

        <Row
          label='Section heading — h2 className="text-xl font-semibold text-foreground mb-4"'
          code={`// ✅ CORRECT — app page section heading
<h2 className="text-xl font-semibold text-foreground mb-4">
  Quick Stats
</h2>

// ❌ WRONG — bare h2 (too large for an in-page section)
<h2>Quick Stats</h2>

// ❌ WRONG — semantic element wrong
<p className="text-xl font-semibold mb-4">Quick Stats</p>`}
        >
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Quick Stats
          </h2>
        </Row>

        <Row
          label='Sub-section heading — h3 className="text-base font-semibold text-foreground"'
          code={`// ✅ CORRECT — sub-section within a page section
<h3 className="text-base font-semibold text-foreground">
  Open Issues
</h3>`}
        >
          <h3 className="text-base font-semibold text-foreground">
            Open Issues
          </h3>
        </Row>
      </section>

      <Separator />

      {/* Text styles */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-foreground">Text Styles</h2>
        </div>

        <Row
          label="Body text — p (leading-7, not-first:mt-4)"
          code={`<p>Body paragraph text. Leading-7 with margin between consecutive paragraphs.</p>
<p>Second paragraph automatically gets margin-top.</p>`}
        >
          <p>
            Body paragraph text. Leading-7 with margin between consecutive
            paragraphs.
          </p>
          <p>Second paragraph automatically gets margin-top.</p>
        </Row>

        <Row
          label="Muted text — text-muted-foreground"
          code={`<p className="text-muted-foreground">Secondary / helper text</p>
<p className="text-sm text-muted-foreground">Small muted text for metadata</p>
<p className="text-xs text-muted-foreground">Extra small for timestamps, labels</p>`}
        >
          <div className="space-y-1">
            <p className="text-muted-foreground">Secondary / helper text</p>
            <p className="text-sm text-muted-foreground">
              Small muted text for metadata
            </p>
            <p className="text-xs text-muted-foreground">
              Extra small for timestamps, labels
            </p>
          </div>
        </Row>

        <Row
          label="text-link — primary color with glow on hover"
          code={`<a href="/somewhere" className="text-link">
  View all issues
</a>`}
        >
          <a href="#" className="text-link">
            View all issues
          </a>
        </Row>

        <Row
          label="Inline code — bg-muted px-1.5 py-0.5 rounded text-xs"
          code={`<code className="text-xs bg-muted px-1.5 py-0.5 rounded">
  someVariable
</code>`}
        >
          <p className="text-sm text-foreground">
            Use{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              pnpm run check
            </code>{" "}
            before committing.
          </p>
        </Row>

        <Row
          label="Monospace label — text-[10px] font-mono text-muted-foreground"
          code={`// Used in the debug pages themselves, and for enum value labels
<span className="text-[10px] font-mono text-muted-foreground">
  in_progress
</span>`}
        >
          <span className="text-[10px] font-mono text-muted-foreground">
            in_progress
          </span>
        </Row>
      </section>

      <Separator />

      {/* Code blocks */}
      <section className="space-y-4">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-foreground">Code Blocks</h2>
        </div>

        <Row
          label="Multi-line code block"
          code={`<pre className="text-xs bg-muted border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground">
  <code>{codeString}</code>
</pre>`}
        >
          <pre className="text-xs bg-muted border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground">
            <code>{`const x = 42;
console.log(x);`}</code>
          </pre>
        </Row>
      </section>
    </div>
  );
}
