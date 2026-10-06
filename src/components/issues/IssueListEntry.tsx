"use client";

import type React from "react";
import Link from "next/link";
import { Loader2, MessageSquare } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { RelativeTime } from "~/components/issues/RelativeTime";
import { formatDate } from "~/lib/dates";
import {
  PRIORITY_CONFIG,
  SEVERITY_CONFIG,
  STATUS_CONFIG,
  STATUS_GROUPS,
  STATUS_GROUP_LABELS,
  ISSUE_FIELD_ICONS,
} from "~/lib/issues/status";
import { formatIssueId } from "~/lib/issues/utils";
import type { IssueListRow } from "~/lib/types";
import { cn } from "~/lib/utils";

/** A person who can be picked as an assignee. */
export interface UserOption {
  id: string;
  name: string;
}

/** The fields a row can change in place (issues-list §3.5). */
export type IssueRowField = "status" | "severity" | "priority" | "assignee";

/** Radio value standing in for "no assignee" (user ids are UUIDs). */
const UNASSIGNED = "unassigned";

interface MenuOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  iconColor?: string;
}

interface MenuSection {
  label?: string;
  options: MenuOption[];
}

/** The status menu's sections, in workflow order. */
const STATUS_GROUP_ORDER = [
  "new",
  "in_progress",
  "closed",
] as const satisfies readonly (keyof typeof STATUS_GROUPS)[];

const STATUS_SECTIONS: MenuSection[] = STATUS_GROUP_ORDER.map((group) => ({
  label: STATUS_GROUP_LABELS[group],
  options: STATUS_GROUPS[group].map((status) => ({
    value: status,
    label: STATUS_CONFIG[status].label,
    icon: STATUS_CONFIG[status].icon,
    iconColor: STATUS_CONFIG[status].iconColor,
  })),
}));

const SEVERITY_SECTIONS: MenuSection[] = [
  {
    options: Object.entries(SEVERITY_CONFIG).map(([value, config]) => ({
      value,
      label: config.label,
      icon: ISSUE_FIELD_ICONS.severity,
      iconColor: config.iconColor,
    })),
  },
];

const PRIORITY_SECTIONS: MenuSection[] = [
  {
    options: Object.entries(PRIORITY_CONFIG).map(([value, config]) => ({
      value,
      label: config.label,
      icon: ISSUE_FIELD_ICONS.priority,
      iconColor: config.iconColor,
    })),
  },
];

/** Up to two initials from a display name: "Priya Shah" → "PS". */
function nameInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? "";
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? "") : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * A dropdown that changes one field. The trigger is whatever the row shows
 * for the field, so a person who may edit sees the same value, now a button.
 */
function FieldMenu({
  trigger,
  label,
  sections,
  value,
  onChange,
  disabled,
  align = "start",
}: {
  trigger: React.ReactElement;
  label: string;
  sections: MenuSection[];
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  align?: "start" | "end";
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] min-w-[200px] overflow-y-auto"
        aria-label={label}
      >
        <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
          {sections.map((section, index) => (
            <div key={section.label ?? index}>
              {index > 0 && <DropdownMenuSeparator />}
              {section.label !== undefined && (
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {section.label}
                </DropdownMenuLabel>
              )}
              {section.options.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.icon !== undefined && (
                    <option.icon
                      className={cn("size-4", option.iconColor)}
                      aria-hidden="true"
                    />
                  )}
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </div>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PILL_CLASSES =
  "inline-flex h-6 items-center gap-1 rounded-full border px-2 align-middle text-xs font-semibold whitespace-nowrap";
const EDITABLE_CLASSES =
  "cursor-pointer transition-colors duration-150 hover:brightness-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

/*
 * Phone hit areas (list-views §7.9: every phone control is at least 44px).
 * A control smaller than 44px keeps its visual size and gets an invisible
 * `::before` that grows its hit area to 44×44 below `md`. Hit areas sit on
 * layer 1 of the row's stacking context and every control's visible part on
 * layer 2, so a hit area only claims taps on space no visible control
 * occupies: tapping a title, machine link, pill, or avatar always reaches
 * that control, even where a neighbor's hit area reaches under it.
 */
const HIT_AREA_CLASSES =
  "relative before:absolute before:z-[1] md:before:hidden";
/** Lifts a control's visible part above neighboring hit areas. */
const VISIBLE_LAYER = "relative z-[2]";

/**
 * One "·"-separated part of an issue row's line 2 after the first. The
 * separator fills the parent's 12px column gap (`gap-x-3`) to the part's left,
 * so a part that wraps to the start of a line takes its separator out of view.
 */
function LinePart({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <span className={cn("relative", className)}>
      <span
        aria-hidden="true"
        className="absolute top-0 right-full w-3 text-center text-muted-foreground"
      >
        ·
      </span>
      {children}
    </span>
  );
}

/** Severity or priority badge; a menu button for people who may change it. */
function FieldPill({
  name,
  label,
  styles,
  icon: Icon,
  editable,
  isUpdating,
  ...menu
}: {
  name: "Severity" | "Priority";
  label: string;
  styles: string;
  icon: LucideIcon;
  editable: boolean;
  isUpdating: boolean;
  sections: MenuSection[];
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const content = (
    <>
      {isUpdating ? (
        <Loader2
          className="size-3 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      ) : (
        <Icon className="size-3" aria-hidden="true" />
      )}
      {label}
    </>
  );
  if (!editable) {
    return (
      <span
        className={cn(PILL_CLASSES, styles)}
        data-testid={`issue-${name.toLowerCase()}`}
      >
        <span className="sr-only">{name}: </span>
        {content}
      </span>
    );
  }
  return (
    <FieldMenu
      label={name}
      disabled={isUpdating}
      {...menu}
      trigger={
        <button
          type="button"
          aria-label={`${name}: ${label}, change`}
          className={cn(
            "group/pill inline-flex cursor-pointer rounded-full align-middle focus-visible:outline-none disabled:cursor-not-allowed",
            // 24px pill → 44px tall; its width already exceeds 44px.
            HIT_AREA_CLASSES,
            "before:-inset-y-2.5 before:inset-x-0"
          )}
          data-testid={`issue-${name.toLowerCase()}`}
        >
          <span
            className={cn(
              PILL_CLASSES,
              VISIBLE_LAYER,
              "transition-colors duration-150 group-hover/pill:brightness-125 group-focus-visible/pill:ring-2 group-focus-visible/pill:ring-ring group-disabled/pill:opacity-60",
              styles
            )}
          >
            {content}
          </span>
        </button>
      }
    />
  );
}

/**
 * The assignee's initials in a circle; an empty dashed circle when nobody is
 * assigned (issues-list §3.7). Names only, never email addresses.
 */
function AssigneeAvatar({
  name,
  isUpdating,
  className,
}: {
  name: string | null;
  isUpdating: boolean;
  className: string;
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        VISIBLE_LAYER,
        name === null
          ? "border border-dashed border-muted-foreground/60"
          : "bg-muted text-foreground",
        className
      )}
    >
      {isUpdating ? (
        <Loader2 className="size-3 animate-spin motion-reduce:animate-none" />
      ) : name === null ? null : (
        nameInitials(name)
      )}
    </span>
  );
}

function AssigneeControl({
  name,
  value,
  users,
  editable,
  isUpdating,
  onChange,
  avatarClassName,
  className,
}: {
  name: string | null;
  value: string;
  users: readonly UserOption[];
  editable: boolean;
  isUpdating: boolean;
  onChange: (value: string) => void;
  avatarClassName: string;
  className: string;
}): React.JSX.Element {
  const who = name === null ? "Unassigned" : `Assigned to ${name}`;
  const avatar = (
    <AssigneeAvatar
      name={name}
      isUpdating={isUpdating}
      className={avatarClassName}
    />
  );
  if (!editable) {
    return (
      <span
        role="img"
        aria-label={who}
        title={who}
        className={cn("inline-flex", className)}
        data-testid="issue-assignee"
      >
        {avatar}
      </span>
    );
  }
  return (
    <FieldMenu
      label="Assignee"
      align="end"
      disabled={isUpdating}
      value={value}
      onChange={onChange}
      sections={[
        { options: [{ value: UNASSIGNED, label: "Unassigned" }] },
        {
          options: users.map((user) => ({ value: user.id, label: user.name })),
        },
      ]}
      trigger={
        <button
          type="button"
          aria-label={`${who}, change assignee`}
          title={who}
          className={cn(
            "inline-flex items-center justify-center rounded-full",
            EDITABLE_CLASSES,
            HIT_AREA_CLASSES,
            className
          )}
          data-testid="issue-assignee"
        >
          {avatar}
        </button>
      }
    />
  );
}

interface IssueListEntryProps {
  issue: IssueListRow;
  /** May change status and severity (`issues.update.reporting`). */
  canEditReporting: boolean;
  /** May change priority and assignee (`issues.update.triage`). */
  canTriage: boolean;
  users: readonly UserOption[];
  onUpdate: (field: IssueRowField, value: string | null) => void;
  updatingField: IssueRowField | null;
  errorField: IssueRowField | null;
}

/**
 * One two-line issue row (issues-list §3.1–§3.7). Line 1: status icon, the
 * full title (wrapping), severity and priority. Line 2: issue ID, machine,
 * status name, and updated age. Desktop adds the comment count and assignee
 * avatar on the right; phones end line 2 with the assignee's initials.
 */
export function IssueListEntry({
  issue,
  canEditReporting,
  canTriage,
  users,
  onUpdate,
  updatingField,
  errorField,
}: IssueListEntryProps): React.JSX.Element {
  const status = STATUS_CONFIG[issue.status];
  const severity = SEVERITY_CONFIG[issue.severity];
  const priority = PRIORITY_CONFIG[issue.priority];
  const issueHref = `/m/${issue.machineInitials}/i/${issue.issueNumber}`;
  const assigneeName = issue.assignedToUser?.name ?? null;
  const assigneeValue = issue.assignedTo ?? UNASSIGNED;
  const onAssigneeChange = (value: string): void =>
    onUpdate("assignee", value === UNASSIGNED ? null : value);

  const statusIcon =
    updatingField === "status" ? (
      <Loader2
        className="size-[18px] animate-spin text-muted-foreground motion-reduce:animate-none"
        aria-hidden="true"
      />
    ) : (
      <status.icon
        className={cn("size-[18px]", status.iconColor)}
        aria-hidden="true"
      />
    );

  return (
    <li
      data-testid="issue-row"
      data-issue-id={issue.id}
      className="isolate flex items-start gap-2.5 px-4 py-2.5 transition-colors sm:max-md:px-8 duration-150 hover:bg-muted/40"
    >
      {errorField !== null && (
        <span role="alert" className="sr-only">
          Failed to update {errorField}. Please try again.
        </span>
      )}

      {canEditReporting ? (
        <FieldMenu
          label="Status"
          sections={STATUS_SECTIONS}
          value={issue.status}
          onChange={(value) => onUpdate("status", value)}
          disabled={updatingField === "status"}
          trigger={
            <button
              type="button"
              aria-label={`Status: ${status.label}, change`}
              className={cn(
                "-ml-1 flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-muted",
                EDITABLE_CLASSES,
                // 28px → 44px, into the row padding and the column gap only.
                HIT_AREA_CLASSES,
                "before:-inset-2"
              )}
              data-testid="issue-status"
            >
              {statusIcon}
            </button>
          }
        />
      ) : (
        <span className="-ml-1 flex size-7 shrink-0 items-center justify-center">
          {statusIcon}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
        <div className="leading-snug">
          <Link
            href={issueHref}
            className={cn(
              "mr-1.5 align-middle text-[15px] font-semibold text-foreground break-words transition-colors duration-150 hover:text-primary",
              VISIBLE_LAYER
            )}
            data-testid="issue-title"
          >
            {issue.title}
          </Link>
          <span className="inline-flex flex-wrap gap-1 align-middle">
            <FieldPill
              name="Severity"
              label={severity.label}
              styles={severity.styles}
              icon={ISSUE_FIELD_ICONS.severity}
              editable={canEditReporting}
              isUpdating={updatingField === "severity"}
              sections={SEVERITY_SECTIONS}
              value={issue.severity}
              onChange={(value) => onUpdate("severity", value)}
            />
            <FieldPill
              name="Priority"
              label={priority.label}
              styles={priority.styles}
              icon={ISSUE_FIELD_ICONS.priority}
              editable={canTriage}
              isUpdating={updatingField === "priority"}
              sections={PRIORITY_SECTIONS}
              value={issue.priority}
              onChange={(value) => onUpdate("priority", value)}
            />
          </span>
        </div>

        {/* Line 2 never truncates (issues-list §3.3): when it does not fit,
            it wraps between its parts, so every part shows in full. Each
            separator sits in the column gap before its part; a part that
            starts a wrapped line pushes its separator past the left edge,
            where `overflow-x-clip` hides it. Only the machine name, the one
            part that can outgrow a phone line by itself, may break inside. */}
        <div className="flex min-w-0 items-start gap-2">
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5 overflow-x-clip text-[13px] text-muted-foreground">
            <span
              className="whitespace-nowrap font-mono text-foreground/85"
              data-testid="issue-id"
            >
              {formatIssueId(issue.machineInitials, issue.issueNumber)}
            </span>
            <LinePart className="min-w-0 break-words">
              <Link
                href={`/m/${issue.machineInitials}`}
                className={cn(
                  "underline decoration-primary/30 underline-offset-2 transition-colors duration-150 hover:text-foreground",
                  VISIBLE_LAYER
                )}
              >
                {issue.machine.name}
              </Link>
            </LinePart>
            <LinePart className={cn("whitespace-nowrap", status.iconColor)}>
              {status.label}
            </LinePart>
            <LinePart className="whitespace-nowrap">
              <span className="hidden md:inline">updated </span>
              <RelativeTime
                value={issue.updatedAt}
                format="compact"
                fallback={formatDate(issue.updatedAt)}
              />
            </LinePart>
          </p>
          <AssigneeControl
            name={assigneeName}
            value={assigneeValue}
            users={users}
            editable={canTriage}
            isUpdating={updatingField === "assignee"}
            onChange={onAssigneeChange}
            avatarClassName="size-5 text-[9px]"
            className="-my-1.5 -mr-1.5 size-8 shrink-0 items-center justify-center before:-inset-1.5 md:hidden"
          />
        </div>
      </div>

      <div className="hidden w-28 shrink-0 items-center justify-end gap-3.5 pt-1 text-[13px] text-muted-foreground md:flex">
        {issue.commentCount > 0 && (
          <span
            className="inline-flex items-center gap-1"
            data-testid="issue-comment-count"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
            {issue.commentCount}
            <span className="sr-only">
              {issue.commentCount === 1 ? " comment" : " comments"}
            </span>
          </span>
        )}
        <AssigneeControl
          name={assigneeName}
          value={assigneeValue}
          users={users}
          editable={canTriage}
          isUpdating={updatingField === "assignee"}
          onChange={onAssigneeChange}
          avatarClassName="size-6 text-[10px]"
          className=""
        />
      </div>
    </li>
  );
}
