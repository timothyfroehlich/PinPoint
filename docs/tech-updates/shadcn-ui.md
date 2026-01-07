# shadcn/ui: 2025 Updates

_Component library updates and new features_

## Key Updates

Major improvements to component management and customization for modern React development.

## Migration Context

PinPoint adopting shadcn/ui during RSC Migration Phase 1A while transitioning from Material UI.

**Integration points:**

- Server Components by default
- Tailwind v4 compatible
- Material UI replacement during transition

## 2025 Updates

**Universal Registry Items (July 2025)**

- Local file support for component management

**Enhanced Calendar Components (July 2025)**

- Improved date components for issue handling

**Radix UI Improvements (June 2025)**

- Better accessibility patterns

**Tailwind v4 Integration (Feb 2025)**

- CSS architecture alignment

**Blocks System (Jan 2025)**

- Pre-built component patterns

---

## 🚀 Revolutionary Features (2025)

### **1. Blocks System (January 2025)**

```bash
# NEW: Pre-built component compositions
pnpm exec shadcn@latest add block dashboard-01
pnpm exec shadcn@latest add block authentication-01
pnpm exec shadcn@latest add block sidebar-01
```

**Perfect for PinPoint:**

- **Dashboard blocks**: Issue management interfaces
- **Authentication blocks**: User management patterns
- **Data table blocks**: Machine inventory displays
- **Form blocks**: Issue creation and editing

### **2. Universal Registry (July 2025)**

```bash
# NEW: Local file support and custom registries
pnpm exec shadcn@latest add button --registry ./components/registry
pnpm exec shadcn@latest add custom-issue-card --registry local
```

**Benefits for PinPoint:**

- **Custom components**: PinPoint-specific issue management components
- **Local registry**: Private component library for organization patterns
- **Version control**: Better tracking of component customizations

### **3. Enhanced CLI Features**

```bash
# NEW: Component diffing and updates
pnpm exec shadcn diff                 # Check for component updates
pnpm exec shadcn update button        # Update specific components
pnpm exec shadcn init --force         # Reinitialize configuration
```

---

## 🎨 Component Ecosystem (50+ Production-Ready)

### **Essential Components for PinPoint**

#### **Data Display**

```tsx
// Perfect for issue management
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "~/components/ui/table";

export function IssueCard({ issue }: { issue: Issue }) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {issue.title}
          <Badge
            variant={issue.priority === "high" ? "destructive" : "secondary"}
          >
            {issue.priority}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{issue.description}</p>
      </CardContent>
    </Card>
  );
}
```

#### **Forms & Input**

```tsx
// Server Actions integration
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

export function CreateIssueForm() {
  return (
    <form action={createIssueAction} className="space-y-4">
      <Input name="title" placeholder="Issue title" required />
      <Textarea name="description" placeholder="Issue description" />
      <Select name="priority">
        <SelectTrigger>
          <SelectValue placeholder="Select priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="low">Low</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="high">High</SelectItem>
        </SelectContent>
      </Select>
      <Button type="submit">Create Issue</Button>
    </form>
  );
}
```

#### **Navigation & Layout**

```tsx
// Server Component navigation
import { Separator } from "~/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

export async function ServerNavigation({ user }: { user: User }) {
  return (
    <nav className="flex flex-col space-y-2">
      <div className="flex items-center space-x-2 p-2">
        <Avatar>
          <AvatarImage src={user.avatar} />
          <AvatarFallback>{user.name?.[0]}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>
      <Separator />
      {/* Navigation items */}
    </nav>
  );
}
```

---

## 🔧 Migration from Material UI

### **Component Mapping Strategy**

| Material UI Component | shadcn/ui Replacement    | Migration Notes                       |
| --------------------- | ------------------------ | ------------------------------------- |
| `Button`              | `Button`                 | Direct replacement with variant props |
| `Card`                | `Card` + subcomponents   | More composable structure             |
| `TextField`           | `Input` + `Label`        | Form composition pattern              |
| `Select`              | `Select` + subcomponents | Radix UI based, better a11y           |
| `Dialog`              | `Dialog` + subcomponents | More flexible composition             |
| `AppBar`              | Custom with `Card`       | Server Component based                |
| `DataGrid`            | `Table` + custom logic   | Lighter weight, more control          |

### **Gradual Migration Pattern**

```tsx
// Phase 1: Coexistence
import { Button as MuiButton } from "@mui/material";
import { Button as ShadcnButton } from "~/components/ui/button";

export function TransitionComponent() {
  return (
    <div className="space-y-4">
      {/* Existing MUI components continue working */}
      <MuiButton variant="contained">Legacy Button</MuiButton>

      {/* New development uses shadcn/ui */}
      <ShadcnButton variant="default">New Button</ShadcnButton>
    </div>
  );
}

// Phase 2: Full replacement
export function ModernComponent() {
  return <ShadcnButton variant="default">Fully Migrated</ShadcnButton>;
}
```

---

## ⚡ Performance & Bundle Impact

### **Bundle Size Comparison**

```bash
# Material UI (current PinPoint setup)
@mui/material: ~350KB (minified)
@emotion/react: ~65KB
@emotion/styled: ~45KB
Total: ~460KB

# shadcn/ui (tree-shaken)
Radix primitives: ~45KB (only used components)
Tailwind CSS: ~10KB (purged utilities)
Total: ~55KB

# Bundle reduction: 88% smaller
```

### **Runtime Performance**

- **No runtime CSS-in-JS**: All styles processed at build time
- **Server Components**: Default server rendering, selective hydration
- **Tree shaking**: Only import components you use
- **Modern CSS**: Container queries, cascade layers, logical properties

---

## 🎨 Customization & Theming

### **CSS Variables Integration**

```css
/* src/app/globals.css - shadcn/ui + PinPoint theme */
@layer base {
  :root {
    /* PinPoint brand colors */
    --primary: 214 84% 56%; /* PinPoint blue */
    --primary-foreground: 0 0% 98%;

    /* Issue status colors */
    --success: 142 76% 36%; /* Green for resolved */
    --destructive: 0 84% 60%; /* Red for critical */
    --warning: 38 92% 50%; /* Orange for pending */

    /* Component-specific */
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
  }
}
```

### **Component Customization**

```tsx
// Custom variant creation
import { cva, type VariantProps } from "class-variance-authority";

const issueStatusVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        open: "bg-blue-50 text-blue-700 border border-blue-200",
        "in-progress": "bg-yellow-50 text-yellow-700 border border-yellow-200",
        resolved: "bg-green-50 text-green-700 border border-green-200",
        closed: "bg-gray-50 text-gray-700 border border-gray-200",
      },
    },
  }
);

export function IssueStatusBadge({
  status,
  ...props
}: VariantProps<typeof issueStatusVariants> & React.ComponentProps<"span">) {
  return (
    <span className={issueStatusVariants({ status })} {...props}>
      {status}
    </span>
  );
}
```

---

## 🛠️ PinPoint Implementation Strategy

### **Phase 1A: Foundation (Current)**

```bash
# Already installed based on git status
# shadcn/ui components: Button, Card, Input, Avatar, Separator

# Add essential components for issue management
pnpm exec shadcn@latest add badge
pnpm exec shadcn@latest add table
pnpm exec shadcn@latest add select
pnpm exec shadcn@latest add dialog
pnpm exec shadcn@latest add form
pnpm exec shadcn@latest add toast
```

### **Phase 1B: Data Access Integration**

```tsx
// Server Components + shadcn/ui pattern
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { getIssuesForOrg } from "~/lib/dal/issues";

export default async function IssuesPage({
  params,
}: {
  params: { orgId: string };
}) {
  const issues = await getIssuesForOrg(params.orgId); // DAL function

  return (
    <div className="grid gap-4">
      {issues.map((issue) => (
        <Card key={issue.id} className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {issue.title}
              <Badge variant="secondary">{issue.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{issue.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### **Phase 1C: Server Actions Forms**

```tsx
// Server Actions + shadcn/ui forms
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { createIssueAction } from "~/lib/actions/issue-actions";

export function CreateIssueForm() {
  return (
    <form action={createIssueAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Issue Title</Label>
        <Input
          id="title"
          name="title"
          placeholder="Describe the issue"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          placeholder="Additional details..."
        />
      </div>

      <Button type="submit" className="w-full">
        Create Issue
      </Button>
    </form>
  );
}
```

---

## 📋 Migration Checklist for PinPoint

### **Component Audit**

- [ ] **List Material UI components**: Inventory current MUI usage
- [ ] **Map to shadcn/ui**: Identify replacement components
- [ ] **Custom component needs**: Identify PinPoint-specific patterns
- [ ] **Form handling**: Plan Server Actions integration

### **Implementation Steps**

- [ ] **Install remaining components**: Add components based on audit
- [ ] **Create component wrappers**: Bridge MUI → shadcn/ui during transition
- [ ] **Update form patterns**: Migrate to Server Actions + shadcn/ui
- [ ] **Test component library**: Verify all components render correctly
- [ ] **Performance validation**: Measure bundle size improvements

### **Quality Assurance**

- [ ] **Accessibility testing**: Verify ARIA compliance with Radix primitives
- [ ] **Cross-browser testing**: Ensure modern CSS features work
- [ ] **Mobile responsiveness**: Test mobile layouts and interactions
- [ ] **Theme consistency**: Validate color schemes and spacing

---

## 🎯 Integration with RSC Migration

### **Server Components Synergy**

- **Default behavior**: shadcn/ui components are Server Components by default
- **Selective hydration**: Only interactive components become Client Components
- **Performance**: Reduced JavaScript bundle, faster page loads
- **SEO benefits**: Fully server-rendered content

### **Client Islands Pattern**

```tsx
// Server Component (default)
export function IssueListServer({ issues }: { issues: Issue[] }) {
  return (
    <div className="space-y-4">
      {issues.map((issue) => (
        <IssueCard key={issue.id} issue={issue} />
      ))}
    </div>
  );
}

// Client Island (specific interactivity)
("use client");
export function IssueSearchClient() {
  const [search, setSearch] = useState("");
  return (
    <Input
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="Search issues..."
    />
  );
}

// Hybrid composition
export default function IssuesPage() {
  return (
    <div>
      <IssueSearchClient /> {/* Client island */}
      <IssueListServer /> {/* Server rendered */}
    </div>
  );
}
```

---

## 📚 Resources & Community

### **Official Resources**

- **[shadcn/ui Documentation](https://ui.shadcn.com)** - Official component library
- **[Blocks Gallery](https://ui.shadcn.com/blocks)** - Pre-built component patterns
- **[CLI Reference](https://ui.shadcn.com/docs/cli)** - Command line usage
- **[Theming Guide](https://ui.shadcn.com/docs/theming)** - Customization patterns

### **Integration Guides**

- **[Next.js Integration](https://ui.shadcn.com/docs/installation/next)** - Official Next.js setup
- **[Server Components](https://ui.shadcn.com/docs/components/server)** - RSC patterns
- **[Form Handling](https://ui.shadcn.com/docs/forms)** - Server Actions integration

### **PinPoint Next Steps**

1. **Complete component audit**: Map remaining MUI components
2. **Implement blocks**: Use pre-built patterns for complex interfaces
3. **Custom registry**: Set up PinPoint-specific component library
4. **Performance measurement**: Track bundle size and runtime improvements

---

**Status:** Active development, weekly updates throughout 2025  
**Priority:** CRITICAL for PinPoint's RSC Migration success  
**Migration timeline:** Phase 1A foundation → Phase 1B data integration → Phase 1C forms

---

_Last updated: August 2025_  
_Next review: Monthly component ecosystem updates_
