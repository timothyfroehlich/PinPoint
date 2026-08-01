# Styling with Tailwind CSS v4 & shadcn/ui Patterns

Token-driven styling, `cn()` usage, and the canonical shadcn component shapes.

## Styling with Tailwind CSS v4

### CSS Variables (No Hardcoded Colors)

```typescript
// Use CSS variables from globals.css
<div className="bg-background text-foreground">
  <p className="text-muted-foreground">Muted text</p>
</div>

// BAD: Hardcoded hex colors
<div style={{ backgroundColor: "#ffffff", color: "#000000" }}>
```

### Component Styling

```typescript
// Use className with cn() for merging
import { cn } from "~/lib/utils";

export function Button({ className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-md bg-primary px-4 py-2 text-primary-foreground",
        className
      )}
      {...props}
    />
  );
}

// BAD: String concatenation (doesn't handle conflicts)
<button className={`base-classes ${className}`} />

// BAD: Inline styles
<button style={{ marginTop: '10px' }} />
```

### Global vs Local Styles

```typescript
// Global styles (globals.css)
// - Typography (headings, body text)
// - Theme variables (colors, spacing)

// Local styles (component className)
// - Component-specific layout
// - Responsive design
// - Interactive states (hover, focus)

// BAD: Hardcoded spacing in reusable components
export function Card({ children }: CardProps) {
  return <div className="m-4 p-4">{children}</div>; // Too opinionated
}

// GOOD: Allow className override
export function Card({ children, className }: CardProps) {
  return <div className={cn("rounded-lg border", className)}>{children}</div>;
}
```

## shadcn/ui Component Patterns

### Button Variants

```typescript
import { Button } from "~/components/ui/button";

<Button variant="default">Primary Action</Button>
<Button variant="secondary">Secondary Action</Button>
<Button variant="destructive">Delete</Button>
<Button variant="ghost">Subtle Action</Button>
<Button variant="link">Link Style</Button>
```

### Dialog (Modal) Pattern

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";

export function CreateIssueDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Create Issue</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Issue</DialogTitle>
          <DialogDescription>
            Report a problem with a machine.
          </DialogDescription>
        </DialogHeader>
        <CreateIssueForm />
      </DialogContent>
    </Dialog>
  );
}
```

### Form with shadcn/ui

```typescript
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";

export function IssueForm() {
  return (
    <form action={createIssue} className="space-y-4">
      <div>
        <Label htmlFor="title">Title <span aria-hidden="true">*</span></Label>
        <Input id="title" name="title" required enterKeyHint="next" />
      </div>
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" enterKeyHint="done" />
      </div>
      <Button type="submit">Create Issue</Button>
    </form>
  );
}
```
