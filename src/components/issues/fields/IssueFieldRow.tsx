"use client";

import React from "react";
import { ChevronRight, Loader2, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { MetadataDrawer } from "~/components/issues/fields/MetadataDrawer";
import { groupOptions } from "~/components/issues/fields/group-options";
import { useIsMobile } from "~/hooks/use-is-mobile";
import { cn } from "~/lib/utils";

/**
 * Issue field rows — the Details card's Status / Severity / Priority /
 * Frequency / Assignee rows (spec issue-detail §9). A row is a label on the
 * left and the value with its icon on the right. When the viewer can change
 * the field the whole row is a button that opens the field's picker and ends
 * in a › chevron; otherwise it is plain text with no chevron (§3.7).
 */

const rowClassName =
  "flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm";
const labelClassName = "w-20 shrink-0 text-muted-foreground";

export interface FieldRowValue {
  label: string;
  icon?: LucideIcon | undefined;
  iconColor?: string | undefined;
  /** Replaces the icon, e.g. an assignee's initial. */
  leading?: React.ReactNode;
  muted?: boolean;
}

function RowValue({
  value,
  isPending = false,
}: {
  value: FieldRowValue;
  isPending?: boolean;
}): React.JSX.Element {
  const Icon = value.icon;
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      {isPending ? (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        (value.leading ??
        (Icon ? (
          <Icon
            className={cn("size-4 shrink-0", value.iconColor)}
            aria-hidden="true"
          />
        ) : null))
      )}
      <span
        className={cn(
          "truncate font-medium",
          value.muted ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {value.label}
      </span>
    </span>
  );
}

type FieldRowButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "value"
> & {
  label: string;
  value: FieldRowValue;
  isPending?: boolean;
};

/**
 * An editable row. Forwards its ref so pickers can use it as their trigger.
 *
 * While its save is in flight the row is `aria-disabled`, not `disabled`: a
 * disabled button drops keyboard focus to `<body>`. The pickers refuse to
 * open while `isPending`.
 */
export const FieldRowButton = React.forwardRef<
  HTMLButtonElement,
  FieldRowButtonProps
>(function FieldRowButton(
  { label, value, isPending = false, className, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={`${label}: ${value.label}`}
      className={cn(
        rowClassName,
        "transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring aria-disabled:cursor-wait",
        className
      )}
      aria-disabled={isPending || undefined}
      aria-busy={isPending || undefined}
      {...props}
    >
      <span className={labelClassName}>{label}</span>
      <RowValue value={value} isPending={isPending} />
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );
});

/** A read-only row for viewers who can't change the field. */
export function FieldRowStatic({
  label,
  value,
  testId,
}: {
  label: string;
  value: FieldRowValue;
  testId?: string;
}): React.JSX.Element {
  return (
    <div className={rowClassName} data-testid={testId}>
      <span className={labelClassName}>{label}</span>
      <RowValue value={value} />
    </div>
  );
}

/** A read-only context row whose value is arbitrary content (links, toggles). */
export function ContextRow({
  label,
  children,
  testId,
}: {
  label: string;
  children: React.ReactNode;
  testId?: string;
}): React.JSX.Element {
  return (
    <div className={rowClassName} data-testid={testId}>
      <span className={labelClassName}>{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        {children}
      </div>
    </div>
  );
}

export interface FieldOption<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  description?: string;
  /** Options sharing a group render under one heading, in order. */
  group?: string;
  testId?: string;
}

interface FieldOptionPickerProps<T extends string> {
  label: string;
  options: FieldOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  isPending: boolean;
  testId?: string;
}

/**
 * An editable enum row. Opens a bottom sheet on phones — large tap targets,
 * thumb-reachable — and an anchored menu on desktop. Two component trees, not
 * two stylings of one, which is why this branches on `useIsMobile` (see the
 * hook's note on the CORE-RESP exception). Neither opens while a save is in
 * flight.
 */
export function FieldOptionPicker<T extends string>({
  label,
  options,
  value,
  onSelect,
  isPending,
  testId,
}: FieldOptionPickerProps<T>): React.JSX.Element {
  const isMobile = useIsMobile();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const current = options.find((option) => option.value === value);
  const trigger = (
    <FieldRowButton
      label={label}
      value={{
        label: current?.label ?? value,
        icon: current?.icon,
        iconColor: current?.iconColor,
      }}
      isPending={isPending}
      data-testid={testId}
    />
  );

  if (isMobile) {
    return (
      <MetadataDrawer
        title={label}
        options={options}
        currentValue={value}
        onSelect={onSelect}
        trigger={trigger}
        disabled={isPending}
      />
    );
  }

  const groups = groupOptions(options);
  return (
    <DropdownMenu
      open={menuOpen}
      onOpenChange={(next) => {
        if (next && isPending) return;
        setMenuOpen(next);
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => {
            const option = options.find((o) => o.value === next);
            if (option && option.value !== value) onSelect(option.value);
          }}
        >
          {groups.map(({ group, items }, index) => (
            <React.Fragment key={group ?? "options"}>
              {index > 0 ? <DropdownMenuSeparator /> : null}
              {group ? (
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {group}
                </DropdownMenuLabel>
              ) : null}
              {items.map((option) => {
                const Icon = option.icon;
                return (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    data-testid={option.testId}
                  >
                    <Icon
                      className={cn("size-4", option.iconColor)}
                      aria-hidden="true"
                    />
                    <span>{option.label}</span>
                  </DropdownMenuRadioItem>
                );
              })}
            </React.Fragment>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A field row's save feedback, wrapped with the row so the Details card's
 * dividers stay between rows. Success is announced politely from a visually
 * hidden status region; a failure also shows inline under the row as an alert
 * (the toast alone is too easy to miss).
 */
export function FieldRowWithFeedback({
  announcement,
  error,
  children,
}: {
  /** e.g. "Status changed to Fixed"; empty until a save succeeds. */
  announcement: string;
  error: string | null;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      {children}
      {error ? (
        <p role="alert" className="px-3 pb-2 text-sm text-destructive-text">
          {error}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
