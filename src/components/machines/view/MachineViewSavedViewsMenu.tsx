"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Check, ChevronDown, Trash2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  createSavedMachineViewAction,
  deleteSavedMachineViewAction,
  renameSavedMachineViewAction,
  setMachineViewDefaultAction,
  updateSavedMachineViewAction,
} from "~/app/(app)/m/saved-view-actions";
import {
  getMachineViewPreset,
  MACHINE_VIEW_PAGE_PRESET_VIEW_ID,
} from "~/lib/machines/view/config";
import {
  machineViewSavedStatesEqual,
  toMachineViewSavedState,
} from "~/lib/machines/view/state";
import type {
  MachineViewPresetId,
  MachineViewSavedState,
  MachineViewSavedViews,
  MachineViewSavedViewSummary,
  MachineViewState,
} from "~/lib/types";
import { cn } from "~/lib/utils";

/** A Built-in or Saved View the menu can apply. */
export interface MachineViewSelectableView {
  id: string;
  name: string;
  state: MachineViewSavedState;
}

interface MachineViewSavedViewsMenuProps {
  /** Desktop renders the dropdown; mobile renders the bottom sheet. */
  layout: "desktop" | "mobile";
  savedViews: MachineViewSavedViews;
  /**
   * The applied Saved View id or Page Preset reference, as last navigated to;
   * it runs ahead of `savedViews.activeViewId` until the server responds.
   */
  activeViewId: string | null;
  state: MachineViewState;
  /** Owner filter values valid in this scope (the loader drops the rest). */
  ownerIds: string[];
  preset: MachineViewPresetId;
  /** Opens a Built-in or Saved View at page 1 (spec §8.6, §9.5). */
  onApply: (view: MachineViewSelectableView) => void;
  /** Marks the current configuration as coming from `viewId` (§4.11). */
  onViewSaved: (viewId: string) => void;
}

/**
 * The Saved Views menu (spec §8.7, §8.9, §8.13): a dropdown on desktop and a
 * bottom sheet on phones, with Save changes, Save as new, and Manage views.
 */
export function MachineViewSavedViewsMenu({
  layout,
  savedViews,
  activeViewId,
  state,
  ownerIds,
  preset,
  onApply,
  onViewSaved,
}: MachineViewSavedViewsMenuProps): React.JSX.Element {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [manageOpen, setManageOpen] = React.useState(false);
  const [isSaving, startSaving] = React.useTransition();
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const pagePresetView = savedViews.builtInViews.find(
    (view) => view.id === MACHINE_VIEW_PAGE_PRESET_VIEW_ID[preset]
  );
  const activeSavedView =
    savedViews.views.find((view) => view.id === activeViewId) ?? null;
  // No `view` reference means the Page Preset's configuration (spec §4.11).
  const activeView =
    activeSavedView ??
    savedViews.builtInViews.find((view) => view.id === activeViewId) ??
    pagePresetView ??
    null;
  // A stored owner that no longer exists in this scope was dropped when the
  // view was applied (spec §8.15); it does not make the view read as edited.
  const baseline = activeView
    ? {
        ...activeView.state,
        owner: activeView.state.owner.filter((id) => ownerIds.includes(id)),
      }
    : toMachineViewSavedState(getMachineViewPreset(preset).defaultState);
  const edited = !machineViewSavedStatesEqual(
    toMachineViewSavedState(state),
    baseline,
    preset
  );
  const label = activeView?.name ?? "Views";

  function closeSheet(after: () => void): void {
    setSheetOpen(false);
    after();
  }

  function saveChanges(): void {
    if (!activeSavedView) return;
    setSaveError(null);
    startSaving(async () => {
      const result = await updateSavedMachineViewAction({
        id: activeSavedView.id,
        state: toMachineViewSavedState(state),
      });
      if (!result.ok) {
        setSaveError(result.message);
        return;
      }
      router.refresh();
    });
  }

  const renderList = (
    views: MachineViewSelectableView[],
    close: (after: () => void) => void,
    itemClassName: string
  ): React.JSX.Element[] =>
    views.map((view) => (
      <MenuEntry
        key={view.id}
        className={itemClassName}
        onSelect={() => close(() => onApply(view))}
        active={view.id === activeView?.id}
      >
        <span className="truncate">{view.name}</span>
        {view.id === savedViews.defaultViewId ? (
          <span className="ml-auto pl-3 text-xs text-muted-foreground">
            Default
          </span>
        ) : null}
      </MenuEntry>
    ));

  // Save changes applies only to Saved Views; Built-in Views never change
  // (spec §8.7, §9.4, §9.5).
  const actions = (
    close: (after: () => void) => void,
    itemClassName: string
  ): React.JSX.Element | null =>
    savedViews.canSave ? (
      <>
        {activeSavedView && edited ? (
          <MenuEntry
            className={cn(itemClassName, "font-semibold text-primary")}
            onSelect={() => close(saveChanges)}
          >
            Save changes
          </MenuEntry>
        ) : null}
        <MenuEntry
          className={itemClassName}
          onSelect={() => close(() => setSaveOpen(true))}
        >
          Save as new…
        </MenuEntry>
        <MenuEntry
          className={itemClassName}
          onSelect={() => close(() => setManageOpen(true))}
        >
          Manage views…
        </MenuEntry>
      </>
    ) : null;

  const triggerContent = (
    <>
      <Bookmark className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
      {edited ? (
        <span className="shrink-0 text-xs text-muted-foreground">· Edited</span>
      ) : null}
      <ChevronDown
        className="ml-auto size-3.5 shrink-0 md:ml-0"
        aria-hidden="true"
      />
    </>
  );

  return (
    <>
      {layout === "desktop" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-8 max-w-72 gap-2 px-2.5 font-medium shadow-sm md:inline-flex"
              aria-label={`Views: ${label}${edited ? ", edited" : ""}`}
              data-testid="machine-view-saved-views-trigger"
            >
              {triggerContent}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>Views</DropdownMenuLabel>
            {renderList(savedViews.builtInViews, (after) => after(), "")}
            {savedViews.views.length > 0 ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Saved views</DropdownMenuLabel>
                {renderList(savedViews.views, (after) => after(), "")}
              </>
            ) : null}
            {savedViews.canSave ? <DropdownMenuSeparator /> : null}
            {actions((after) => after(), "pl-8")}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Drawer direction="bottom" open={sheetOpen} onOpenChange={setSheetOpen}>
          <DrawerTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full justify-start gap-2 px-3 font-medium md:hidden"
              aria-label={`Views: ${label}${edited ? ", edited" : ""}`}
              data-testid="machine-view-saved-views-mobile-trigger"
            >
              {triggerContent}
            </Button>
          </DrawerTrigger>
          <DrawerContent className="max-h-[85dvh] rounded-t-2xl">
            <DrawerHeader className="pb-1 text-left">
              <DrawerTitle className="text-lg">Views</DrawerTitle>
              <DrawerDescription className="sr-only">
                Open, save, or manage your views of this list.
              </DrawerDescription>
            </DrawerHeader>
            <DropdownContext.Provider value={false}>
              <div className="flex flex-col gap-1 overflow-y-auto px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                {renderList(
                  savedViews.builtInViews,
                  closeSheet,
                  "min-h-12 text-base"
                )}
                {savedViews.views.length > 0 ? (
                  <>
                    <div className="my-1.5 h-px bg-outline-variant" />
                    <p className="px-3 pt-1 text-xs font-semibold text-muted-foreground">
                      Saved views
                    </p>
                    {renderList(
                      savedViews.views,
                      closeSheet,
                      "min-h-12 text-base"
                    )}
                  </>
                ) : null}
                {savedViews.canSave ? (
                  <div className="my-1.5 h-px bg-outline-variant" />
                ) : null}
                {actions(closeSheet, "min-h-12 pl-10 text-base")}
              </div>
            </DropdownContext.Provider>
          </DrawerContent>
        </Drawer>
      )}

      {saveError ? (
        <p role="alert" className="text-sm text-destructive-text">
          {saveError}
        </p>
      ) : null}
      {isSaving ? (
        <span className="sr-only" role="status">
          Saving view
        </span>
      ) : null}

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        savedViews={savedViews}
        state={state}
        onSaved={onViewSaved}
      />
      <ManageViewsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        savedViews={savedViews}
      />
    </>
  );
}

/**
 * One row of the menu. Inside the desktop dropdown it is a menu item; in the
 * phone sheet it is a plain button. `onSelect` runs in both.
 */
function MenuEntry({
  children,
  className,
  onSelect,
  active,
}: {
  children: React.ReactNode;
  className: string;
  onSelect: () => void;
  active?: boolean | undefined;
}): React.JSX.Element {
  const inDropdown = React.useContext(DropdownContext);
  const indicator =
    active === undefined ? null : (
      <Check
        className={cn("size-4 shrink-0", !active && "invisible")}
        aria-hidden="true"
      />
    );
  if (inDropdown) {
    return (
      <DropdownMenuItem
        className={cn("gap-2", className)}
        onSelect={onSelect}
        aria-current={active ? "true" : undefined}
      >
        {indicator}
        {children}
      </DropdownMenuItem>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-3 text-left text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-muted",
        className
      )}
    >
      {indicator}
      {children}
    </button>
  );
}

const DropdownContext = React.createContext(true);

/** Save as new (spec §8.7, §8.8, §8.10). */
function SaveViewDialog({
  open,
  onOpenChange,
  savedViews,
  state,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedViews: MachineViewSavedViews;
  state: MachineViewState;
  onSaved: (viewId: string) => void;
}): React.JSX.Element {
  const [name, setName] = React.useState("");
  const [makeDefault, setMakeDefault] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

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
      const result = await createSavedMachineViewAction({
        surface: savedViews.surface,
        name,
        state: toMachineViewSavedState(state),
        makeDefault,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onOpenChange(false);
      onSaved(result.value.id);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Save view</DialogTitle>
            <DialogDescription className="sr-only">
              Name the current columns, search, filters, sorting, and page size.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="machine-view-save-name">
              Name <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="machine-view-save-name"
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
              aria-describedby={error ? "machine-view-save-error" : undefined}
            />
            {error ? (
              <p
                id="machine-view-save-error"
                role="alert"
                className="text-sm text-destructive-text"
              >
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="machine-view-save-default"
              checked={makeDefault}
              onCheckedChange={(checked) => setMakeDefault(checked === true)}
            />
            <Label htmlFor="machine-view-save-default" className="font-normal">
              Open this view by default
            </Label>
          </div>
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

/**
 * Choose the default among Built-in and Saved Views; rename or delete Saved
 * Views (spec §8.9, §8.10, §8.14, §9.4).
 */
function ManageViewsDialog({
  open,
  onOpenChange,
  savedViews,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedViews: MachineViewSavedViews;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage views</DialogTitle>
          <DialogDescription className="sr-only">
            Choose the view this page opens with, and rename or delete your
            saved views.
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
          {savedViews.builtInViews.map((view) => (
            <li key={view.id} className="flex items-center gap-2 p-2 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                {view.name}
              </span>
              <DefaultToggle
                savedViews={savedViews}
                viewId={view.id}
                viewName={view.name}
                target={{ kind: "builtIn", id: view.id }}
              />
            </li>
          ))}
        </ul>
        {savedViews.views.length > 0 ? (
          <ul className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
            {savedViews.views.map((view) => (
              <ManageViewRow
                key={view.id}
                view={view}
                savedViews={savedViews}
              />
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function useViewAction(): {
  error: string | null;
  setError: (error: string | null) => void;
  isPending: boolean;
  run: (
    action: () => Promise<{ ok: true } | { ok: false; message: string }>
  ) => void;
} {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();
  function run(
    action: () => Promise<{ ok: true } | { ok: false; message: string }>
  ): void {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.refresh();
    });
  }
  return { error, setError, isPending, run };
}

/** Makes a view the Surface's default, or clears it (spec §8.10). */
function DefaultToggle({
  savedViews,
  viewId,
  viewName,
  target,
}: {
  savedViews: MachineViewSavedViews;
  viewId: string;
  viewName: string;
  target: { kind: "saved"; id: string } | { kind: "builtIn"; id: string };
}): React.JSX.Element {
  const { error, isPending, run } = useViewAction();
  const isDefault = savedViews.defaultViewId === viewId;
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
            ? `Stop opening ${viewName} by default`
            : `Open ${viewName} by default`
        }
        onClick={() =>
          run(() =>
            setMachineViewDefaultAction({
              surface: savedViews.surface,
              target: isDefault ? null : target,
            })
          )
        }
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
  savedViews,
}: {
  view: MachineViewSavedViewSummary;
  savedViews: MachineViewSavedViews;
}): React.JSX.Element {
  const [name, setName] = React.useState(view.name);
  const { error, setError, isPending, run } = useViewAction();
  const errorId = `machine-view-manage-error-${view.id}`;

  React.useEffect(() => {
    setName(view.name);
  }, [view.name]);

  function rename(): void {
    if (name.trim() === view.name) return;
    if (name.trim().length === 0) {
      setError("Enter a name.");
      return;
    }
    run(() => renameSavedMachineViewAction({ id: view.id, name }));
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
        <DefaultToggle
          savedViews={savedViews}
          viewId={view.id}
          viewName={view.name}
          target={{ kind: "saved", id: view.id }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={`Delete ${view.name}`}
          onClick={() => run(() => deleteSavedMachineViewAction(view.id))}
          className="size-9 shrink-0 text-destructive-text"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
    </li>
  );
}
