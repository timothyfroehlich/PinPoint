# Typography Patterns

We enforce global typography defaults in `src/app/globals.css` using the `@layer base` directive. This ensures a consistent typographic hierarchy without requiring utility classes on every element.

## Global Defaults

The following elements have default styles applied:

- **h1**: `text-4xl font-extrabold tracking-tight lg:text-5xl`
- **h2**: `text-3xl font-semibold tracking-tight`
- **h3**: `text-2xl font-semibold tracking-tight`
- **h4**: `text-xl font-semibold tracking-tight`
- **p**: `leading-7 [&:not(:first-child)]:mt-6`
- **a**: `font-medium text-primary underline underline-offset-4`

## Usage

Simply use the semantic HTML tags.

```tsx
export function PageTitle() {
  return (
    <div>
      <h1>My Page Title</h1>
      <p>This is a paragraph with standard leading and spacing.</p>
    </div>
  );
}
```
