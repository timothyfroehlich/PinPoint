import React from "react";
import Link from "next/link";

type MDXComponents = Record<
  string,
  React.ComponentType<React.PropsWithChildren<Record<string, unknown>>>
>;

/** The plain text of a heading's children, for its fragment id. */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

/** "Link your Pinball Map account" → "link-your-pinball-map-account". */
function headingId(children: React.ReactNode): string {
  return textOf(children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }: React.PropsWithChildren) => (
      <h1 className="text-xl font-semibold mt-10 first:mt-0">{children}</h1>
    ),
    // Help articles: ## is a part of the article, ### a section within it,
    // #### a subsection. Parts and sections carry fragment ids so the
    // "On this page" navigation (HelpPage `toc`) can link to them.
    h2: ({ children }: React.PropsWithChildren) => (
      <h2
        id={headingId(children)}
        className="mt-12 scroll-mt-16 border-t border-border pt-8 text-2xl font-bold tracking-tight first:mt-0 first:border-t-0 first:pt-0"
      >
        {children}
      </h2>
    ),
    h3: ({ children }: React.PropsWithChildren) => (
      <h3
        id={headingId(children)}
        className="mt-8 scroll-mt-16 text-lg font-semibold"
      >
        {children}
      </h3>
    ),
    h4: ({ children }: React.PropsWithChildren) => (
      <h4 className="mt-6 text-base font-semibold">{children}</h4>
    ),
    p: ({ children }: React.PropsWithChildren) => (
      <p className="text-sm text-muted-foreground mt-3">{children}</p>
    ),
    ul: ({ children }: React.PropsWithChildren) => (
      <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground mt-3">
        {children}
      </ul>
    ),
    ol: ({ children }: React.PropsWithChildren) => (
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground mt-3">
        {children}
      </ol>
    ),
    li: ({ children }: React.PropsWithChildren) => <li>{children}</li>,
    hr: () => <hr className="my-8 border-border" />,
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
