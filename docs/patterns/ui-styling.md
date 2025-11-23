# UI & Styling Patterns

## Component Usage

- **shadcn/ui**: Use the provided components in `src/components/ui`. Do not import directly from Radix UI unless necessary for a custom primitive.
- **Tailwind CSS**: Use utility classes for layout, spacing, and typography.
- **CSS Variables**: Use CSS variables for colors (defined in `globals.css`) to support theming (e.g., `bg-background`, `text-foreground`).

## Layout Patterns

- **Container**: Use a standard container for page content.
- **Responsive Design**: Mobile-first approach. Use `md:`, `lg:` prefixes for larger screens.
