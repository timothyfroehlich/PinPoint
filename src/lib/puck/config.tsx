import type { Config } from "@puckeditor/core";
import React from "react";

/**
 * Puck configuration for UX prototyping.
 * Defines the available components that can be used in the visual editor.
 * 
 * This is a development-only feature for rapid prototyping and UX iteration.
 */

// Component configurations
export const puckConfig: Config = {
  components: {
    HeadingBlock: {
      fields: {
        level: {
          type: "select",
          options: [
            { label: "H1", value: "h1" },
            { label: "H2", value: "h2" },
            { label: "H3", value: "h3" },
            { label: "H4", value: "h4" },
            { label: "H5", value: "h5" },
            { label: "H6", value: "h6" },
          ],
        },
        children: {
          type: "text",
        },
      },
      defaultProps: {
        level: "h2",
        children: "Heading Text",
      },
      render: (props) => {
        const { level, children } = props;
        const Tag = level as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        const sizeClasses: Record<
          "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
          string
        > = {
          h1: "text-4xl font-bold",
          h2: "text-3xl font-semibold",
          h3: "text-2xl font-semibold",
          h4: "text-xl font-semibold",
          h5: "text-lg font-semibold",
          h6: "text-base font-semibold",
        };
        return <Tag className={sizeClasses[Tag]}>{children}</Tag>;
      },
    },
    TextBlock: {
      fields: {
        text: {
          type: "textarea",
        },
      },
      defaultProps: {
        text: "Add your text here...",
      },
      render: (props) => {
        return <p className="text-base leading-relaxed">{props["text"]}</p>;
      },
    },
    ButtonBlock: {
      fields: {
        label: {
          type: "text",
        },
        variant: {
          type: "select",
          options: [
            { label: "Default", value: "default" },
            { label: "Destructive", value: "destructive" },
            { label: "Outline", value: "outline" },
            { label: "Secondary", value: "secondary" },
            { label: "Ghost", value: "ghost" },
          ],
        },
        href: {
          type: "text",
        },
      },
      defaultProps: {
        label: "Click Me",
        variant: "default",
        href: "#",
      },
      render: (props) => {
        const { label, variant, href } = props;
        const v = variant as
          | "default"
          | "destructive"
          | "outline"
          | "secondary"
          | "ghost";
        const variantClasses: Record<
          "default" | "destructive" | "outline" | "secondary" | "ghost",
          string
        > = {
          default: "bg-primary text-primary-foreground hover:bg-primary/90",
          destructive:
            "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          outline:
            "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
          secondary:
            "bg-secondary text-secondary-foreground hover:bg-secondary/80",
          ghost: "hover:bg-accent hover:text-accent-foreground",
        };
        return (
          <a
            href={(href as string | undefined) ?? "#"}
            className={`inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${variantClasses[v]}`}
          >
            {label}
          </a>
        );
      },
    },
    CardBlock: {
      fields: {
        title: {
          type: "text",
        },
        description: {
          type: "textarea",
        },
      },
      defaultProps: {
        title: "Card Title",
        description: "Card description goes here...",
      },
      render: (props) => {
        const { title, description } = props;
        return (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        );
      },
    },
    SpacerBlock: {
      fields: {
        size: {
          type: "select",
          options: [
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
      },
      defaultProps: {
        size: "medium",
      },
      render: (props) => {
        const { size } = props;
        const s = size as "small" | "medium" | "large";
        const sizeClasses: Record<"small" | "medium" | "large", string> = {
          small: "h-4",
          medium: "h-8",
          large: "h-16",
        };
        return <div className={sizeClasses[s]} />;
      },
    },
  },
};
