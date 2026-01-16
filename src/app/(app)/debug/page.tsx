import type React from "react";
import Link from "next/link";

export default function DebugIndexPage(): React.JSX.Element {
  const debugTools = [
    {
      title: "Issue Badge System",
      description:
        "View all issue badge variations (status, severity, priority, consistency)",
      href: "/debug/badges",
    },
    {
      title: "Puck Visual Editor",
      description:
        "Visual drag-and-drop editor for UX prototyping and layout experimentation",
      href: "/debug/puck",
    },
    {
      title: "Puck Preview",
      description: "View saved Puck prototypes without the editor interface",
      href: "/debug/puck/preview",
    },
  ];

  return (
    <div className="p-8 space-y-8 bg-background min-h-screen">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold">Developer Debug Tools</h1>
        <p className="text-muted-foreground">
          Tools for development, debugging, and UX prototyping
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
        {debugTools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="block p-6 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">{tool.title}</h2>
            <p className="text-sm text-muted-foreground">{tool.description}</p>
          </Link>
        ))}
      </div>

      <div className="pt-8 border-t border-border">
        <h2 className="text-lg font-semibold mb-4">Documentation</h2>
        <p className="text-sm text-muted-foreground">
          See <code className="px-1.5 py-0.5 bg-muted rounded text-xs">docs/PUCK_INTEGRATION.md</code> in the repository for detailed Puck integration guide.
        </p>
      </div>
    </div>
  );
}
