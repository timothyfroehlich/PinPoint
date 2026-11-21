"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

/** One entry in an item's ⋯ menu: text only (design-bible §26.3). */
export type ItemMenuEntry = {
  key: string;
  /** Ends in "…" only when the entry asks for more input; Delete never does. */
  label: string;
  destructive?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Why the entry is disabled, shown under its label and read with it. */
  disabledReason?: string | undefined;
  /** The entry's action is running; it shows a spinner and is disabled. */
  busy?: boolean | undefined;
  /** The entry is the current choice, such as the view being shown. */
  current?: boolean | undefined;
  /**
   * The entry moves focus itself, into an editor or a dialog, so the menu
   * leaves focus there rather than returning it to its button.
   */
  keepsFocus?: boolean | undefined;
  testId?: string | undefined;
} & (
  | { href: string }
  | { onSelect: () => void }
  /** A submenu of further entries, such as a card to copy from. */
  | { submenu: readonly ItemMenuEntry[] }
);

/** A group of entries, a divider between groups, optionally titled. */
export type ItemMenuSection =
  | readonly ItemMenuEntry[]
  | { label: string; entries: readonly ItemMenuEntry[] };

interface ItemActionsMenuProps {
  /** The button's name, "<item> actions", such as "Comment actions". */
  label: string;
  /** Ids of elements that say which item, read after the name. */
  describedBy?: string | undefined;
  /** Text that says which item, read after the name, when no element does. */
  description?: string | undefined;
  /**
   * The menu's entries in sections. A section of only destructive entries
   * goes last, after a divider.
   */
  sections: readonly ItemMenuSection[];
  /**
   * False when choosing an entry moves focus somewhere the menu must not pull
   * it back from, such as an editor that raises the iOS keyboard.
   */
  modal?: boolean | undefined;
  align?: "start" | "end" | undefined;
  /** The ⋯ button, for a caller that returns focus to it later. */
  triggerRef?: React.Ref<HTMLButtonElement> | undefined;
  /** Position only, such as negative margins in a dense row. */
  triggerClassName?: string | undefined;
  testId?: string | undefined;
}

// An array has an `entries` method, so a titled section is told apart by
// not being an array.
function isTitled(
  section: ItemMenuSection
): section is { label: string; entries: readonly ItemMenuEntry[] } {
  return !Array.isArray(section);
}

function entriesOf(section: ItemMenuSection): readonly ItemMenuEntry[] {
  return isTitled(section) ? section.entries : section;
}

function isDestructiveSection(section: ItemMenuSection): boolean {
  const entries = entriesOf(section);
  return (
    entries.length > 0 && entries.every((entry) => entry.destructive === true)
  );
}

// A borderless icon button, 32px on desktop and 44px on phones, with a hover
// and pressed background (design-bible §26.2).
const triggerClass =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:bg-muted data-[state=open]:bg-muted motion-reduce:transition-none md:size-8";

function EntryLabel({
  entry,
  reasonId,
}: {
  entry: ItemMenuEntry;
  reasonId: string;
}): React.JSX.Element {
  const showReason =
    entry.disabled === true && entry.disabledReason !== undefined;
  return (
    <>
      <span className="flex min-w-0 flex-col">
        <span>{entry.label}</span>
        {showReason ? (
          <span id={reasonId} className="text-xs text-muted-foreground">
            {entry.disabledReason}
          </span>
        ) : null}
      </span>
      {entry.busy ? (
        <Loader2
          aria-hidden="true"
          className="ml-auto size-4 animate-spin motion-reduce:animate-none"
        />
      ) : null}
    </>
  );
}

function MenuEntry({
  entry,
  onChoose,
}: {
  entry: ItemMenuEntry;
  /** Records the choice before the menu closes. */
  onChoose: (entry: ItemMenuEntry) => void;
}): React.JSX.Element {
  const reasonId = React.useId();
  const disabled = entry.disabled === true || entry.busy === true;
  const variant: "destructive" | "default" = entry.destructive
    ? "destructive"
    : "default";
  const common = {
    disabled,
    variant,
    "aria-describedby":
      entry.disabled === true && entry.disabledReason !== undefined
        ? reasonId
        : undefined,
    "data-testid": entry.testId,
    className: cn(
      "max-md:min-h-11",
      entry.current === true && "font-semibold text-primary"
    ),
  };
  if ("submenu" in entry) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          disabled={disabled}
          data-testid={entry.testId}
          className="max-md:min-h-11"
        >
          {entry.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {entry.submenu.map((child) => (
            <MenuEntry key={child.key} entry={child} onChoose={onChoose} />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  if ("href" in entry) {
    return (
      <DropdownMenuItem {...common} asChild>
        <Link
          href={entry.href}
          aria-current={entry.current === true ? "true" : undefined}
        >
          <EntryLabel entry={entry} reasonId={reasonId} />
        </Link>
      </DropdownMenuItem>
    );
  }
  return (
    <DropdownMenuItem
      {...common}
      onSelect={() => {
        onChoose(entry);
        entry.onSelect();
      }}
    >
      <EntryLabel entry={entry} reasonId={reasonId} />
    </DropdownMenuItem>
  );
}

/**
 * An item's ⋯ menu (design-bible §26.3), such as a comment's or a settings
 * set's: a borderless ⋯ button named for the item, with a tooltip on
 * desktop, opening a dropdown at every width. Closing it returns focus to
 * the button unless the chosen entry moved focus itself.
 */
export function ItemActionsMenu({
  label,
  describedBy,
  description,
  sections,
  modal,
  align = "end",
  triggerRef,
  triggerClassName,
  testId,
}: ItemActionsMenuProps): React.JSX.Element {
  const descriptionId = React.useId();
  const keepFocusRef = React.useRef(false);
  const shown = sections.filter((section) => entriesOf(section).length > 0);
  const ordered = [
    ...shown.filter((section) => !isDestructiveSection(section)),
    ...shown.filter(isDestructiveSection),
  ];
  const describedByIds =
    [describedBy, description !== undefined ? descriptionId : undefined]
      .filter((id) => id !== undefined)
      .join(" ") || undefined;
  const onChoose = (entry: ItemMenuEntry): void => {
    keepFocusRef.current = entry.keepsFocus === true;
  };

  return (
    <TooltipProvider delayDuration={300}>
      <DropdownMenu modal={modal}>
        <Tooltip>
          <DropdownMenuTrigger asChild>
            <TooltipTrigger asChild>
              <button
                ref={triggerRef}
                type="button"
                aria-label={label}
                aria-describedby={describedByIds}
                data-testid={testId}
                className={cn(triggerClass, triggerClassName)}
              >
                <MoreHorizontal
                  aria-hidden="true"
                  className="size-[18px] md:size-4"
                />
              </button>
            </TooltipTrigger>
          </DropdownMenuTrigger>
          <TooltipContent className="max-md:hidden">{label}</TooltipContent>
        </Tooltip>
        {description !== undefined ? (
          <span id={descriptionId} hidden>
            {description}
          </span>
        ) : null}
        <DropdownMenuContent
          align={align}
          onCloseAutoFocus={(event) => {
            if (!keepFocusRef.current) return;
            keepFocusRef.current = false;
            event.preventDefault();
          }}
        >
          {ordered.map((section, index) => (
            <React.Fragment
              key={entriesOf(section)
                .map((e) => e.key)
                .join("|")}
            >
              {index > 0 ? <DropdownMenuSeparator /> : null}
              {isTitled(section) ? (
                <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
              ) : null}
              {entriesOf(section).map((entry) => (
                <MenuEntry key={entry.key} entry={entry} onChoose={onChoose} />
              ))}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
