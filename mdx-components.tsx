import type React from "react";
import Link from "next/link";

type MDXComponents = Record<
  string,
  React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>
>;

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children }: React.PropsWithChildren) => (
      <h2 className="text-lg font-semibold mt-8 first:mt-0">{children}</h2>
    ),
    h3: ({ children }: React.PropsWithChildren) => (
      <h3 className="text-base font-semibold mt-4">{children}</h3>
    ),
    p: ({ children }: React.PropsWithChildren) => (
      <p className="text-sm text-muted-foreground mt-3">{children}</p>
    ),
    ul: ({ children }: React.PropsWithChildren) => (
      <ul className="space-y-2 text-sm text-muted-foreground mt-3">
        {children}
      </ul>
    ),
    ol: ({ children }: React.PropsWithChildren) => (
      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground mt-3">
        {children}
      </ol>
    ),
    strong: ({ children }: React.PropsWithChildren) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    a: ({
      href,
      children,
    }: React.PropsWithChildren<{ href?: string | undefined }>) => {
      if (href?.startsWith("/")) {
        return (
          <Link href={href} className="text-primary underline">
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          className="text-primary underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    table: ({ children }: React.PropsWithChildren) => (
      <div className="overflow-x-auto mt-3">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }: React.PropsWithChildren) => <thead>{children}</thead>,
    tbody: ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>,
    tr: ({ children }: React.PropsWithChildren) => (
      <tr className="border-b">{children}</tr>
    ),
    th: ({ children }: React.PropsWithChildren) => (
      <th className="text-left p-2 font-medium text-foreground">{children}</th>
    ),
    td: ({ children }: React.PropsWithChildren) => (
      <td className="p-2 text-muted-foreground">{children}</td>
    ),
    pre: ({ children }: React.PropsWithChildren) => (
      <pre className="bg-muted rounded-md p-4 text-sm overflow-x-auto mt-3">
        {children}
      </pre>
    ),
    code: ({ children }: React.PropsWithChildren) => (
      <code className="bg-muted rounded px-1.5 py-0.5 text-sm">{children}</code>
    ),
    ...components,
  };
}
