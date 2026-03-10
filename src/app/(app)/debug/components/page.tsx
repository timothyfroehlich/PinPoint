"use client";

import type React from "react";
import { useState } from "react";
import { Trash2, Plus, Settings, ChevronRight } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

function Section({
  title,
  rule,
  children,
}: {
  title: string;
  rule?: string;
  children: React.ReactNode;
}): React.JSX.Element {
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
      {children}
    </section>
  );
}

function CodeBlock({ children }: { children: string }): React.JSX.Element {
  return (
    <pre className="text-xs bg-muted border border-border rounded-lg p-3 overflow-x-auto text-muted-foreground mt-2">
      <code>{children}</code>
    </pre>
  );
}

export default function ComponentsPage(): React.JSX.Element {
  const [checked, setChecked] = useState(false);
  const [switched, setSwitched] = useState(false);

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-10">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Components</h2>
        <p className="text-muted-foreground">
          All components are from shadcn/ui. Never add custom styling to
          buttons, inputs, or form elements — use variants and sizes instead.
        </p>
      </div>

      {/* Buttons */}
      <Section title="Button Variants" rule="CORE-UI-011">
        <p className="text-sm text-muted-foreground">
          Use the variant that matches the action hierarchy. Never apply custom
          background colors to buttons.
        </p>
        <div className="flex flex-wrap gap-3 items-center">
          <Button>Default</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
        <CodeBlock>{`<Button>Default</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>`}</CodeBlock>
      </Section>

      <Section title="Button Sizes" rule="CORE-UI-011">
        <div className="flex flex-wrap gap-3 items-center">
          <Button size="lg">Large</Button>
          <Button>Default</Button>
          <Button size="sm">Small</Button>
          <Button size="icon" aria-label="Add item">
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Settings">
            <Settings className="size-4" />
          </Button>
          <Button size="icon" variant="destructive" aria-label="Delete">
            <Trash2 className="size-4" />
          </Button>
        </div>
        <CodeBlock>{`<Button size="lg">Large</Button>
<Button>Default</Button>
<Button size="sm">Small</Button>

// Icon buttons always need aria-label
<Button size="icon" aria-label="Add item">
  <Plus className="size-4" />
</Button>`}</CodeBlock>
      </Section>

      <Separator />

      {/* AlertDialog */}
      <Section title="Destructive Action Confirmation" rule="CORE-UI-012">
        <p className="text-sm text-muted-foreground">
          All irreversible actions require{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            AlertDialog
          </code>{" "}
          confirmation. Never make a destructive action fire on a single click.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete Issue</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The issue and all its comments
                will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <CodeBlock>{`<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Delete Issue</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Delete this issue?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Delete</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>`}</CodeBlock>
      </Section>

      <Separator />

      {/* Form inputs */}
      <Section title="Form Inputs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="text-input">Text Input</Label>
            <Input id="text-input" placeholder="e.g. Left flipper stuck" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disabled-input">Disabled Input</Label>
            <Input id="disabled-input" placeholder="Disabled" disabled />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="textarea">Textarea</Label>
            <Textarea
              id="textarea"
              placeholder="Describe the issue in detail..."
              rows={3}
            />
          </div>
        </div>
        <CodeBlock>{`<div className="space-y-2">
  <Label htmlFor="title">Title</Label>
  <Input id="title" placeholder="e.g. Left flipper stuck" />
</div>

<div className="space-y-2">
  <Label htmlFor="description">Description</Label>
  <Textarea id="description" placeholder="Describe the issue..." rows={3} />
</div>`}</CodeBlock>
      </Section>

      <Section title="Select">
        <div className="w-48">
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <CodeBlock>{`<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select priority" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="low">Low</SelectItem>
    <SelectItem value="medium">Medium</SelectItem>
    <SelectItem value="high">High</SelectItem>
  </SelectContent>
</Select>`}</CodeBlock>
      </Section>

      <Section title="Checkbox & Switch">
        <div className="flex flex-wrap gap-8 items-center">
          <div className="flex items-center gap-2">
            <Checkbox
              id="checkbox-example"
              checked={checked}
              onCheckedChange={(v) => setChecked(Boolean(v))}
            />
            <Label htmlFor="checkbox-example">
              {checked ? "Checked" : "Unchecked"}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="switch-example"
              checked={switched}
              onCheckedChange={setSwitched}
            />
            <Label htmlFor="switch-example">{switched ? "On" : "Off"}</Label>
          </div>
        </div>
        <CodeBlock>{`<div className="flex items-center gap-2">
  <Checkbox id="notify" checked={checked} onCheckedChange={setChecked} />
  <Label htmlFor="notify">Email notifications</Label>
</div>

<div className="flex items-center gap-2">
  <Switch id="dark-mode" checked={on} onCheckedChange={setOn} />
  <Label htmlFor="dark-mode">Dark mode</Label>
</div>`}</CodeBlock>
      </Section>

      <Separator />

      {/* Alerts */}
      <Section title="Alerts">
        <p className="text-sm text-muted-foreground">
          For inline feedback messages. Use{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            useActionState
          </code>{" "}
          for form feedback instead of toast (CORE-ARCH-007).
        </p>
        <div className="space-y-3">
          <Alert>
            <ChevronRight className="size-4" />
            <AlertTitle>Info</AlertTitle>
            <AlertDescription>
              Default alert for informational messages.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <Trash2 className="size-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Something went wrong. Please try again.
            </AlertDescription>
          </Alert>
        </div>
        <CodeBlock>{`<Alert>
  <InfoIcon className="size-4" />
  <AlertTitle>Info</AlertTitle>
  <AlertDescription>Informational message.</AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="size-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>Something went wrong.</AlertDescription>
</Alert>`}</CodeBlock>
      </Section>

      <Separator />

      {/* Badge */}
      <Section title="Badge (shadcn/ui)">
        <p className="text-sm text-muted-foreground">
          For non-domain badges (user roles, boolean flags, generic labels). For
          status/severity/priority/frequency use{" "}
          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
            IssueBadge
          </code>{" "}
          (CORE-UI-015) — see the Badges page.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
        <CodeBlock>{`<Badge>Admin</Badge>
<Badge variant="secondary">Member</Badge>
<Badge variant="outline">Invited</Badge>
<Badge variant="destructive">Blocked</Badge>`}</CodeBlock>
      </Section>
    </div>
  );
}
