import type React from "react";

interface SwatchProps {
  name: string;
  className: string;
  token: string;
}

function Swatch({ name, className, token }: SwatchProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-10 rounded-lg border border-outline-variant shrink-0 ${className}`}
      />
      <div className="min-w-0">
        <p className="text-sm text-foreground font-medium truncate">{name}</p>
        <p className="text-[10px] font-mono text-muted-foreground truncate">
          {token}
        </p>
      </div>
    </div>
  );
}

interface SwatchGroupProps {
  title: string;
  rule?: string;
  children: React.ReactNode;
}

function SwatchGroup({
  title,
  rule,
  children,
}: SwatchGroupProps): React.JSX.Element {
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  );
}

export default function ColorsPage(): React.JSX.Element {
  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Color Tokens</h2>
        <p className="text-muted-foreground">
          All available CSS variable tokens. Use these names as Tailwind classes
          (e.g.{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            bg-primary
          </code>
          ,{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            text-muted-foreground
          </code>
          ). Never use raw Tailwind palette colors like{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            text-amber-500
          </code>{" "}
          in app code.
        </p>
        <div className="inline-flex items-center gap-2 bg-warning-container text-on-warning-container text-xs px-3 py-1.5 rounded-lg">
          <strong>CORE-UI-005:</strong> semantic tokens only — no raw palette
          colors
        </div>
      </div>

      <SwatchGroup title="Base">
        <Swatch
          name="Background"
          className="bg-background"
          token="bg-background / text-background"
        />
        <Swatch
          name="Foreground"
          className="bg-foreground"
          token="bg-foreground / text-foreground"
        />
        <Swatch name="Card" className="bg-card" token="bg-card" />
        <Swatch name="Surface" className="bg-surface" token="bg-surface" />
        <Swatch
          name="Surface Variant"
          className="bg-surface-variant"
          token="bg-surface-variant"
        />
        <Swatch name="Muted" className="bg-muted" token="bg-muted" />
        <Swatch name="Accent" className="bg-accent" token="bg-accent" />
        <Swatch
          name="Muted Foreground"
          className="bg-muted-foreground"
          token="text-muted-foreground"
        />
        <Swatch
          name="On Surface Variant"
          className="bg-on-surface-variant"
          token="text-on-surface-variant"
        />
      </SwatchGroup>

      <SwatchGroup title="Primary (APC Neon Green)" rule="CORE-UI-005">
        <Swatch
          name="Primary"
          className="bg-primary"
          token="bg-primary / text-primary"
        />
        <Swatch
          name="On Primary"
          className="bg-on-primary"
          token="bg-on-primary / text-on-primary"
        />
        <Swatch
          name="Primary Container"
          className="bg-primary-container"
          token="bg-primary-container"
        />
        <Swatch
          name="On Primary Container"
          className="bg-on-primary-container"
          token="text-on-primary-container"
        />
      </SwatchGroup>

      <SwatchGroup title="Secondary (Electric Purple)" rule="CORE-UI-005">
        <Swatch
          name="Secondary"
          className="bg-secondary"
          token="bg-secondary / text-secondary"
        />
        <Swatch
          name="On Secondary"
          className="bg-on-secondary"
          token="text-on-secondary"
        />
        <Swatch
          name="Secondary Container"
          className="bg-secondary-container"
          token="bg-secondary-container"
        />
        <Swatch
          name="On Secondary Container"
          className="bg-on-secondary-container"
          token="text-on-secondary-container"
        />
      </SwatchGroup>

      <SwatchGroup title="Semantic — Success" rule="CORE-UI-005">
        <Swatch
          name="Success"
          className="bg-success"
          token="bg-success / text-success"
        />
        <Swatch
          name="Success Container"
          className="bg-success-container"
          token="bg-success-container"
        />
        <Swatch
          name="On Success Container"
          className="bg-on-success-container"
          token="text-on-success-container"
        />
      </SwatchGroup>

      <SwatchGroup title="Semantic — Warning" rule="CORE-UI-005">
        <Swatch
          name="Warning"
          className="bg-warning"
          token="bg-warning / text-warning"
        />
        <Swatch
          name="Warning Container"
          className="bg-warning-container"
          token="bg-warning-container"
        />
        <Swatch
          name="On Warning Container"
          className="bg-on-warning-container"
          token="text-on-warning-container"
        />
      </SwatchGroup>

      <SwatchGroup title="Semantic — Error / Destructive" rule="CORE-UI-005">
        <Swatch
          name="Error / Destructive"
          className="bg-error"
          token="bg-error / bg-destructive / text-destructive"
        />
        <Swatch
          name="Error Container"
          className="bg-error-container"
          token="bg-error-container"
        />
        <Swatch
          name="On Error Container"
          className="bg-on-error-container"
          token="text-on-error-container"
        />
      </SwatchGroup>

      <SwatchGroup title="Status Colors">
        <Swatch
          name="Status: New"
          className="bg-status-new"
          token="bg-status-new / text-status-new"
        />
        <Swatch
          name="Status: In Progress"
          className="bg-status-in-progress"
          token="bg-status-in-progress / text-status-in-progress"
        />
        <Swatch
          name="Status: Unplayable"
          className="bg-status-unplayable"
          token="bg-status-unplayable / text-status-unplayable"
        />
      </SwatchGroup>

      <SwatchGroup title="Borders & Inputs">
        <Swatch name="Border" className="bg-border" token="border-border" />
        <Swatch name="Input" className="bg-input" token="bg-input" />
        <Swatch name="Ring" className="bg-ring" token="ring-ring" />
        <Swatch name="Outline" className="bg-outline" token="border-outline" />
        <Swatch
          name="Outline Variant"
          className="bg-outline-variant"
          token="border-outline-variant"
        />
      </SwatchGroup>

      <section className="space-y-4">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-foreground">
            Glow Effects
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            CORE-UI-016
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Only use glow on interactive surfaces. Match glow color to the
          card&apos;s semantic meaning.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              label: "glow-primary",
              cls: "glow-primary border-primary/20",
              desc: "Primary action cards",
            },
            {
              label: "glow-success",
              cls: "glow-success border-success/30",
              desc: "Fixed / healthy states",
            },
            {
              label: "glow-warning",
              cls: "glow-warning border-warning/30",
              desc: "Attention needed",
            },
            {
              label: "glow-destructive",
              cls: "glow-destructive border-destructive/30",
              desc: "Error / critical states",
            },
            {
              label: "glow-secondary",
              cls: "glow-secondary border-secondary/30",
              desc: "Secondary accents (use sparingly)",
            },
          ].map(({ label, cls, desc }) => (
            <div
              key={label}
              className={`p-4 rounded-lg border bg-card ${cls} space-y-1`}
            >
              <p className="text-sm font-mono text-foreground">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline gap-3 border-b border-border pb-2">
          <h2 className="text-xl font-semibold text-foreground">
            Custom Utilities
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border bg-card space-y-2">
            <p className="text-sm font-mono text-muted-foreground">text-link</p>
            <a href="#" className="text-link">
              This is a text-link — primary color with glow on hover
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
