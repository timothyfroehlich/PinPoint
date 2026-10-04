"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
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
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import type {
  ActionOutcome,
  DefaultViewTarget,
  ListViewEntry,
  ListViewsModel,
} from "./types";

/** Save as new (list-views §5.3, §10.1, §10.7, §10.9). */
export function SaveViewDialog({
  open,
  onOpenChange,
  views,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: ListViewsModel;
}): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  const nameId = React.useId();
  const errorId = `${nameId}-error`;
  const defaultId = `${nameId}-default`;

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setMakeDefault(false);
    setError(null);
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (name.trim().length === 0) {
      setError("Enter a name.");
      return;
    }
    startTransition(async () => {
      const result = await views.actions.saveAsNew({
        name,
        makeDefault: views.offersDefault && makeDefault,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription className="sr-only">
              Name the current fields, search, filters, sorting, and page size.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>
              Name <span aria-hidden="true">*</span>
            </Label>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              maxLength={60}
              required
              autoComplete="off"
              enterKeyHint="done"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p
                id={errorId}
                role="alert"
                className="text-sm text-destructive-text"
              >
                {error}
              </p>
            ) : null}
          </div>
          {views.offersDefault ? (
            <div className="flex items-center gap-2.5">
              <Checkbox
                id={defaultId}
                checked={makeDefault}
                onCheckedChange={(checked) => setMakeDefault(checked === true)}
              />
              <Label htmlFor={defaultId} className="font-normal">
                Open this view by default
              </Label>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function useViewAction(): {
  error: string | null;
  setError: (error: string | null) => void;
  isPending: boolean;
  run: (action: () => Promise<ActionOutcome>) => void;
} {
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  function run(action: () => Promise<ActionOutcome>): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setError(result.message);
    });
  }
  return { error, setError, isPending, run };
}

/** Makes a view the host's Default View, or clears it (§10.8, §10.9). */
function DefaultToggle({
  views,
  view,
  kind,
}: {
  views: ListViewsModel;
  view: ListViewEntry;
  kind: "saved" | "builtIn";
}): React.JSX.Element {
  const { error, isPending, run } = useViewAction();
  const isDefault = views.defaultViewId === view.id;
  const target: DefaultViewTarget = isDefault ? null : { kind, id: view.id };
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        aria-pressed={isDefault}
        aria-label={
          isDefault
            ? `Stop opening ${view.name} by default`
            : `Open ${view.name} by default`
        }
        onClick={() => run(() => views.actions.setDefault(target))}
        className={cn(
          "h-9 shrink-0",
          isDefault
            ? "border-primary bg-primary/10 text-primary"
            : "text-muted-foreground"
        )}
      >
        {isDefault ? "Default" : "Make default"}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-destructive-text">
          {error}
        </p>
      ) : null}
    </>
  );
}

function ManageViewRow({
  view,
  views,
}: {
  view: ListViewEntry;
  views: ListViewsModel;
}): React.JSX.Element {
  const [name, setName] = React.useState(view.name);
  const { error, setError, isPending, run } = useViewAction();
  const errorId = React.useId();
  const isDefault = views.defaultViewId === view.id;

  React.useEffect(() => {
    setName(view.name);
  }, [view.name]);

  function rename(): void {
    if (name.trim() === view.name) return;
    if (name.trim().length === 0) {
      setError("Enter a name.");
      return;
    }
    run(() => views.actions.rename(view.id, name));
  }

  return (
    <li className="space-y-1 p-2 pl-3" aria-busy={isPending}>
      <div className="flex items-center gap-2">
        <Input
          aria-label="View name"
          value={name}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
          onBlur={rename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              rename();
            }
          }}
          className="h-9 min-w-0 flex-1"
        />
        {views.offersDefault ? (
          <DefaultToggle views={views} view={view} kind="saved" />
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Delete ${view.name}`}
              disabled={isPending}
              className="size-9 shrink-0 text-destructive-text"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {view.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {isDefault
                  ? "This is your default view. This page will open to its standard view instead."
                  : "This view will be removed permanently."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                variant="destructive"
                onClick={() => run(() => views.actions.remove(view.id))}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
    </li>
  );
}

/**
 * Manage views (list-views §10.8): rename or delete Saved Views and, on the
 * host's main page only, choose the Default View among Built-in and Saved
 * Views (§10.9, §10.13, §10.16).
 */
export function ManageViewsDialog({
  open,
  onOpenChange,
  views,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: ListViewsModel;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage views</DialogTitle>
          <DialogDescription className="sr-only">
            {views.offersDefault
              ? "Choose the view this page opens with, and rename or delete your saved views."
              : "Rename or delete your saved views."}
          </DialogDescription>
        </DialogHeader>
        {views.offersDefault ? (
          <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
            {views.builtInViews.map((view) => (
              <li key={view.id} className="flex items-center gap-2 p-2 pl-3">
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {view.name}
                </span>
                <DefaultToggle views={views} view={view} kind="builtIn" />
              </li>
            ))}
          </ul>
        ) : null}
        {views.savedViews.length > 0 ? (
          <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
            {views.savedViews.map((view) => (
              <ManageViewRow key={view.id} view={view} views={views} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No saved views yet.</p>
        )}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
