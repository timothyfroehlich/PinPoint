"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronDown,
  Loader2,
  MoreHorizontal,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useIsMobile } from "~/hooks/use-is-mobile";
import {
  planPageActions,
  type PageActionsPlan,
} from "~/lib/list-view/overflow";
import { cn } from "~/lib/utils";
import { useMeasuredWidths } from "./use-measured-widths";

/**
 * Runs a page action. `opener` is the control it was chosen from, the
 * action's own button or its menu's trigger (⋯ once it folds), so a dialog
 * it opens can return focus there (useReturnFocus).
 */
export type PageActionSelect = (opener: HTMLElement | null) => void;

/** One entry in ⋯ or in an action's own menu. */
export type PageMenuEntry = {
  key: string;
  label: string;
  /** Read instead of the label when the entry shows more, such as a count. */
  accessibleLabel?: string | undefined;
  /** A count after the label, such as the print queue (apron-cards §13.4). */
  count?: number | undefined;
  destructive?: boolean | undefined;
  /** The entry's action is running; it shows a spinner and is disabled. */
  busy?: boolean | undefined;
  testId?: string | undefined;
  /**
   * The icon the entry shows as its own button. Only an entry with one can
   * show as a button when it would be ⋯'s only entry (list-views §3.7).
   */
  icon?: LucideIcon | undefined;
  /** The entry's label as its own button, when it reads differently there. */
  buttonLabel?: string | undefined;
} & ({ href: string } | { onSelect: PageActionSelect });

interface PageActionBase {
  key: string;
  label: string;
  icon: LucideIcon;
  /** The page's create action keeps its filled style (list-views §3.8). */
  primary?: boolean | undefined;
  /** The action is running; its button shows a spinner and is disabled. */
  busy?: boolean | undefined;
  testId?: string | undefined;
}

/**
 * A page action (list-views §1): a link, a button, or a menu of entries.
 * Folded into ⋯, a link or button becomes one entry and a menu brings its
 * entries (§3.9), or `foldedEntries` when they read differently there.
 */
export type PageAction = PageActionBase &
  (
    | { href: string }
    | { onSelect: PageActionSelect }
    | {
        entries: readonly PageMenuEntry[];
        foldedEntries?: readonly PageMenuEntry[] | undefined;
      }
  );

/** ⋯'s accessible name, its label while the page actions show labels, and
 * its phone sheet's title (design-bible §26.3). */
export const PAGE_ACTIONS_MENU_LABEL = "More";

const GAP = 8;

// Buttons 36px tall with 8px corners on desktop and 44px with 10px corners
// on phones; an icon button is square (list-views §3.8, §7.9). Every face
// keeps a 1px border, transparent when borderless, so measured widths
// match whichever face shows.
const buttonBaseClass =
  "inline-flex h-11 shrink-0 items-center justify-center rounded-[10px] border text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60 data-[state=open]:bg-muted motion-reduce:transition-none md:h-9 md:rounded-lg";
// A labeled button is outlined; an icon button is borderless, with a hover
// and pressed background (design-bible §26.2).
const outlinedClass = "border-outline bg-card text-foreground hover:bg-muted";
const borderlessClass =
  "border-transparent bg-transparent text-foreground hover:bg-muted active:bg-muted";
// Before the first measurement, CSS guesses: icons below md, labels above.
const guessSurfaceClass =
  "border-outline bg-card text-foreground hover:bg-muted max-md:border-transparent max-md:bg-transparent max-md:hover:bg-muted max-md:active:bg-muted max-md:data-[state=open]:bg-muted";
const primaryClass =
  "border-primary bg-primary text-on-primary hover:bg-primary/90 data-[state=open]:bg-primary/90";
const labeledClass = "gap-1.5 px-3";
const iconClass = "w-11 md:w-9";
const guessClass = "max-md:w-11 md:gap-1.5 md:px-3";

type Face = "labeled" | "icon" | "guess";

function buttonClass(primary: boolean | undefined, face: Face): string {
  return cn(
    buttonBaseClass,
    primary
      ? primaryClass
      : face === "labeled"
        ? outlinedClass
        : face === "icon"
          ? borderlessClass
          : guessSurfaceClass,
    face === "labeled" ? labeledClass : face === "icon" ? iconClass : guessClass
  );
}

function ActionFace({
  icon: Icon,
  label,
  face,
  chevron,
  busy = false,
}: {
  icon: LucideIcon;
  label: string;
  face: Face;
  chevron: boolean;
  busy?: boolean | undefined;
}): React.JSX.Element {
  const iconClassName = face === "icon" ? "size-[18px] md:size-4" : "size-4";
  return (
    <>
      {busy ? (
        <Loader2
          aria-hidden="true"
          className={cn(
            iconClassName,
            "animate-spin motion-reduce:animate-none"
          )}
        />
      ) : (
        <Icon aria-hidden="true" className={iconClassName} />
      )}
      {face === "icon" ? null : (
        <span className={face === "guess" ? "max-md:hidden" : undefined}>
          {label}
        </span>
      )}
      {chevron && face !== "icon" ? (
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5", face === "guess" && "max-md:hidden")}
        />
      ) : null}
    </>
  );
}

/**
 * An icon button's tooltip, its accessible name on desktop (design-bible
 * §26.2). It wraps every face so the button keeps its place in the tree
 * when the face changes, and shows only for an icon face. It goes inside a
 * menu or sheet trigger and forwards that trigger's props, so the trigger's
 * open state stays on the button.
 */
type ActionTooltipProps = Omit<
  React.ComponentPropsWithoutRef<typeof TooltipTrigger>,
  "asChild"
> & { label: string; face: Face };

const ActionTooltip = React.forwardRef<
  React.ElementRef<typeof TooltipTrigger>,
  ActionTooltipProps
>(function ActionTooltip({ label, face, children, ...triggerProps }, ref) {
  return (
    <Tooltip>
      <TooltipTrigger asChild {...triggerProps} ref={ref}>
        {children}
      </TooltipTrigger>
      {face === "icon" ? (
        <TooltipContent className="max-md:hidden">{label}</TooltipContent>
      ) : null}
    </Tooltip>
  );
});

function entryKey(entry: PageMenuEntry): string {
  return entry.key;
}

/** The entries an action brings into ⋯ when it folds (§3.9). */
function foldedEntriesOf(action: PageAction): readonly PageMenuEntry[] {
  if ("entries" in action) return action.foldedEntries ?? action.entries;
  if ("href" in action) {
    return [
      {
        key: action.key,
        label: action.label,
        testId: action.testId,
        href: action.href,
      },
    ];
  }
  return [
    {
      key: action.key,
      label: action.label,
      testId: action.testId,
      onSelect: action.onSelect,
    },
  ];
}

/** ⋯'s only entry as its own button (list-views §3.7). */
function entryAsAction(entry: PageMenuEntry, icon: LucideIcon): PageAction {
  const base = {
    key: entry.key,
    label: entry.buttonLabel ?? entry.label,
    icon,
    busy: entry.busy,
    testId: entry.testId,
  };
  return "href" in entry
    ? { ...base, href: entry.href }
    : { ...base, onSelect: entry.onSelect };
}

function EntryCount({ count }: { count: number }): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-on-primary tabular-nums"
      data-testid="page-menu-count"
    >
      {count}
    </span>
  );
}

function EntryContent({ entry }: { entry: PageMenuEntry }): React.JSX.Element {
  return (
    <>
      {entry.label}
      {entry.busy ? (
        <Loader2
          aria-hidden="true"
          className="ml-auto size-4 animate-spin motion-reduce:animate-none"
        />
      ) : entry.count !== undefined && entry.count > 0 ? (
        <EntryCount count={entry.count} />
      ) : null}
    </>
  );
}

/** Entries in a dropdown menu, a divider between sections. */
function MenuEntries({
  sections,
  opener,
}: {
  sections: readonly (readonly PageMenuEntry[])[];
  /** The menu's trigger, which an entry's dialog returns focus to. */
  opener: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  return (
    <>
      {sections.map((section, index) => (
        <React.Fragment key={section.map(entryKey).join("|")}>
          {index > 0 ? <DropdownMenuSeparator /> : null}
          {section.map((entry) =>
            "href" in entry ? (
              <DropdownMenuItem key={entry.key} asChild>
                <Link
                  href={entry.href}
                  aria-label={entry.accessibleLabel}
                  data-testid={entry.testId}
                >
                  <EntryContent entry={entry} />
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                key={entry.key}
                variant={entry.destructive ? "destructive" : "default"}
                disabled={entry.busy}
                aria-label={entry.accessibleLabel}
                data-testid={entry.testId}
                onSelect={() => entry.onSelect(opener.current)}
              >
                <EntryContent entry={entry} />
              </DropdownMenuItem>
            )
          )}
        </React.Fragment>
      ))}
    </>
  );
}

const sheetRowClass =
  "flex min-h-12 w-full items-center gap-2.5 border-b border-border text-left text-base text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset disabled:opacity-60";

/** ⋯ on phones: a sheet of the same entries (list-views §3.10, §12.2). */
function ActionsSheet({
  trigger,
  sections,
  opener,
}: {
  trigger: React.ReactNode;
  sections: readonly (readonly PageMenuEntry[])[];
  opener: React.RefObject<HTMLButtonElement | null>;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  return (
    <Drawer direction="bottom" open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="bg-card data-[vaul-drawer-direction=bottom]:max-h-[92dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <div className="flex shrink-0 items-center gap-1 border-b border-border p-1 pl-4">
          <DrawerTitle className="flex-1 text-lg font-bold">
            {PAGE_ACTIONS_MENU_LABEL}
          </DrawerTitle>
          <DrawerDescription className="sr-only">
            Actions for this page.
          </DrawerDescription>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {sections.map((section, index) => (
            <ul
              key={section.map(entryKey).join("|")}
              className={cn(index > 0 && "mt-3 border-t border-border")}
            >
              {section.map((entry) => (
                <li key={entry.key}>
                  {"href" in entry ? (
                    <Link
                      href={entry.href}
                      aria-label={entry.accessibleLabel}
                      data-testid={entry.testId}
                      onClick={() => setOpen(false)}
                      className={sheetRowClass}
                    >
                      <EntryContent entry={entry} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={entry.busy}
                      aria-label={entry.accessibleLabel}
                      data-testid={entry.testId}
                      onClick={() => {
                        setOpen(false);
                        entry.onSelect(opener.current);
                      }}
                      className={cn(
                        sheetRowClass,
                        entry.destructive && "text-destructive-text"
                      )}
                    >
                      <EntryContent entry={entry} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** One page action as its own button (§3.8). */
function ActionButton({
  action,
  face,
}: {
  action: PageAction;
  face: Face;
}): React.JSX.Element {
  const menuTriggerRef = React.useRef<HTMLButtonElement>(null);
  const className = buttonClass(action.primary, face);
  if ("href" in action) {
    return (
      <ActionTooltip label={action.label} face={face}>
        <Link
          href={action.href}
          aria-label={action.label}
          data-testid={action.testId}
          className={className}
        >
          <ActionFace
            icon={action.icon}
            label={action.label}
            face={face}
            chevron={false}
          />
        </Link>
      </ActionTooltip>
    );
  }
  if ("onSelect" in action) {
    return (
      <ActionTooltip label={action.label} face={face}>
        <button
          type="button"
          aria-label={action.label}
          disabled={action.busy}
          data-testid={action.testId}
          onClick={(event) => action.onSelect(event.currentTarget)}
          className={className}
        >
          <ActionFace
            icon={action.icon}
            label={action.label}
            face={face}
            chevron={false}
            busy={action.busy}
          />
        </button>
      </ActionTooltip>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ActionTooltip label={action.label} face={face}>
          <button
            ref={menuTriggerRef}
            type="button"
            aria-label={action.label}
            data-testid={action.testId}
            className={className}
          >
            <ActionFace
              icon={action.icon}
              label={action.label}
              face={face}
              chevron
            />
          </button>
        </ActionTooltip>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <MenuEntries sections={[action.entries]} opener={menuTriggerRef} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** ⋯, last of the page actions: a menu on desktop and a sheet on phones. */
function ActionsMenu({
  face,
  sections,
}: {
  face: Face;
  sections: readonly (readonly PageMenuEntry[])[];
}): React.JSX.Element {
  // Menu or sheet is a behavior swap CSS cannot express (CORE-RESP-002's
  // sanctioned use-is-mobile exception); the button's look stays in CSS.
  const isMobile = useIsMobile();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const trigger = (
    <ActionTooltip label={PAGE_ACTIONS_MENU_LABEL} face={face}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={PAGE_ACTIONS_MENU_LABEL}
        data-testid="page-actions-menu"
        className={buttonClass(false, face)}
      >
        <ActionFace
          icon={MoreHorizontal}
          label={PAGE_ACTIONS_MENU_LABEL}
          face={face}
          chevron={false}
        />
      </button>
    </ActionTooltip>
  );
  if (isMobile) {
    return (
      <ActionsSheet trigger={trigger} sections={sections} opener={triggerRef} />
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <MenuEntries sections={sections} opener={triggerRef} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface PageActionsProps {
  /** The page's actions before ⋯, in the order its spec names them. */
  actions: readonly PageAction[];
  /**
   * What ⋯ holds of its own, in sections with a divider between. Folded
   * actions come before them, and a section of only destructive entries
   * stays last. A lone entry with an icon shows as its own button while
   * there is room (list-views §3.7).
   */
  menu: readonly (readonly PageMenuEntry[])[];
  /** The page's fold order (§3.9): the actions each step folds together. */
  foldSteps: readonly (readonly string[])[];
  className?: string | undefined;
}

/**
 * A page's actions (list-views §3.7–§3.10, §7.2, §8.11, §8.12;
 * design-bible §26): outlined labeled buttons while they all fit the room
 * their row gives them and borderless icon buttons otherwise, folding into
 * ⋯ in the page's order once even the icons do not fit. The component
 * takes the free width of its row and measures itself there (CORE-RESP-002
 * boundary), never the screen.
 */
export function PageActions({
  actions,
  menu,
  foldSteps,
  className,
}: PageActionsProps): React.JSX.Element | null {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const laneRef = React.useRef<HTMLDivElement>(null);
  const ownSections = menu.filter((section) => section.length > 0);
  // ⋯'s only entry shows as its own button while there is room (§3.7).
  const ownEntries = ownSections.flat();
  const onlyEntry = ownEntries.length === 1 ? ownEntries[0] : undefined;
  const lone =
    onlyEntry?.icon !== undefined
      ? { entry: onlyEntry, action: entryAsAction(onlyEntry, onlyEntry.icon) }
      : null;
  const buttons = lone ? [...actions, lone.action] : actions;
  const moreHasItems = ownSections.length > 0 && !lone;
  const contentKey = [
    ...buttons.map((action) => `${action.key}:${action.label}`),
    String(moreHasItems),
  ].join("|");
  const measured = useMeasuredWidths(containerRef, laneRef, contentKey);
  const width = (key: string): number => measured?.widths[key] ?? 0;
  const widthsOf = (
    action: PageAction
  ): { key: string; labeled: number; icon: number } => ({
    key: action.key,
    labeled: width(`${action.key}:labeled`),
    icon: width(`${action.key}:icon`),
  });
  // A row that is not laid out measures zero; CSS guesses until it is.
  const plan: PageActionsPlan | null =
    measured && measured.available > 0
      ? planPageActions({
          available: measured.available,
          actions: actions.map(widthsOf),
          more: { labeled: width("more:labeled"), icon: width("more:icon") },
          moreHasItems,
          loneEntry: lone ? widthsOf(lone.action) : undefined,
          foldSteps,
          gap: GAP,
        })
      : null;
  const face: Face = plan ? (plan.labeled ? "labeled" : "icon") : "guess";
  const folded = new Set(plan?.folded ?? []);
  const shown = buttons.filter((action) => !folded.has(action.key));
  // Folded actions share one section, first in ⋯, in their display order.
  // A folded lone entry goes back to ⋯ as itself.
  const foldedSection = actions
    .filter((action) => folded.has(action.key))
    .flatMap(foldedEntriesOf);
  const menuSections = lone && !folded.has(lone.action.key) ? [] : ownSections;
  const isDestructiveSection = (section: readonly PageMenuEntry[]): boolean =>
    section.every((entry) => entry.destructive === true);
  const sections = [
    ...(foldedSection.length > 0 ? [foldedSection] : []),
    ...menuSections.filter((section) => !isDestructiveSection(section)),
    ...menuSections.filter(isDestructiveSection),
  ];
  const showMore = plan ? plan.showMore : moreHasItems;

  if (actions.length === 0 && ownSections.length === 0) return null;

  return (
    // One provider for the page's tooltips, at the app's delay
    // (ClientProviders), so the actions render anywhere.
    <TooltipProvider delayDuration={300}>
      <div
        ref={containerRef}
        data-page-actions=""
        className={cn(
          // Never narrower than one icon button, so a lone ⋯ always fits.
          "relative flex min-w-11 flex-1 items-center justify-end gap-2 md:min-w-9",
          className
        )}
      >
        {shown.map((action) => (
          <ActionButton key={action.key} action={action} face={face} />
        ))}
        {showMore ? <ActionsMenu face={face} sections={sections} /> : null}

        {/* Each action's width labeled and as an icon, as static faces kept
            out of the accessibility tree and clipped so they never widen the
            page (CORE-RESP-002 boundary). */}
        <div
          ref={laneRef}
          aria-hidden="true"
          className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
        >
          {buttons.map((action) => (
            <React.Fragment key={action.key}>
              <span
                data-measure={`${action.key}:labeled`}
                className={cn(
                  "absolute w-max",
                  buttonClass(action.primary, "labeled")
                )}
              >
                <ActionFace
                  icon={action.icon}
                  label={action.label}
                  face="labeled"
                  chevron={"entries" in action}
                />
              </span>
              <span
                data-measure={`${action.key}:icon`}
                className={cn("absolute", buttonClass(action.primary, "icon"))}
              >
                <ActionFace
                  icon={action.icon}
                  label={action.label}
                  face="icon"
                  chevron={false}
                />
              </span>
            </React.Fragment>
          ))}
          <span
            data-measure="more:labeled"
            className={cn("absolute w-max", buttonClass(false, "labeled"))}
          >
            <ActionFace
              icon={MoreHorizontal}
              label={PAGE_ACTIONS_MENU_LABEL}
              face="labeled"
              chevron={false}
            />
          </span>
          <span
            data-measure="more:icon"
            className={cn("absolute", buttonClass(false, "icon"))}
          >
            <ActionFace
              icon={MoreHorizontal}
              label={PAGE_ACTIONS_MENU_LABEL}
              face="icon"
              chevron={false}
            />
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}
