"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpDown, Check, ChevronDown, Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { planListHeader } from "~/lib/list-view/overflow";
import { cn } from "~/lib/utils";
import { listHeaderIconButtonClass } from "./classes";
import { isPlainClick } from "./links";
import { CompactPager, RangeTextFace } from "./ListPager";
import {
  offersManageViews,
  sortDirectionOptions,
  type ListDisplayModel,
  type ListPaginationModel,
  type ListSortModel,
  type ListViewEntry,
  type ListViewsModel,
} from "./types";
import { useMeasuredWidths } from "./use-measured-widths";

const GAP = 2;

const tabClass =
  "inline-flex h-9 shrink-0 items-center gap-1.5 px-2.5 text-sm whitespace-nowrap text-muted-foreground shadow-[inset_0_-2px_0_transparent] transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset motion-reduce:transition-none";
const currentTabClass =
  "font-semibold text-foreground shadow-[inset_0_-2px_0_var(--color-primary)]";
const ghostButtonClass =
  "inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-muted data-[state=open]:text-foreground motion-reduce:transition-none";
const iconButtonClass = listHeaderIconButtonClass;

function TabFace({
  name,
  edited,
}: {
  name: string;
  edited: boolean;
}): React.JSX.Element {
  return (
    <>
      <span className="min-w-0 truncate">{name}</span>
      {edited ? (
        <span className="shrink-0 font-normal text-warning">
          <span aria-hidden="true">· </span>Edited
        </span>
      ) : null}
    </>
  );
}

/** The sort control (list-views §5.5; machine-views §3.14). */
function SortMenu({ sort }: { sort: ListSortModel }): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(ghostButtonClass, "text-foreground")}
        data-testid="list-sort-trigger"
      >
        <ArrowUpDown aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Sort: </span>
        {sort.label}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort.field}
          onValueChange={(field) =>
            sort.onChange(field, sort.preferredDirection(field))
          }
        >
          {sort.fields.map((field) => (
            <DropdownMenuRadioItem key={field.value} value={field.value}>
              {field.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Order</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={sort.dir}
          onValueChange={(dir) => {
            if (dir === "asc" || dir === "desc") sort.onChange(sort.field, dir);
          }}
        >
          {sortDirectionOptions(sort).map((dir) => (
            <DropdownMenuRadioItem key={dir.value} value={dir.value}>
              {dir.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** View options (list-views §5.6, §5.7): page size and displayed fields. */
function ViewOptionsMenu({
  display,
}: {
  display: ListDisplayModel;
}): React.JSX.Element {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        aria-label="View options"
        className={iconButtonClass}
        data-testid="list-view-options-trigger"
      >
        <Columns3 aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Rows per page</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={String(display.pageSize)}
          onValueChange={(value) => display.onPageSizeChange(Number(value))}
        >
          {display.pageSizes.map((size) => (
            <DropdownMenuRadioItem key={size} value={String(size)}>
              {size}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {display.fields ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Fields</DropdownMenuLabel>
            {display.fields.options.map((field) => (
              <DropdownMenuCheckboxItem
                key={field.value}
                checked={
                  display.fields?.selected.includes(field.value) ?? false
                }
                onCheckedChange={(checked) =>
                  display.fields?.onToggle(field.value, checked === true)
                }
                onSelect={(event) => event.preventDefault()}
              >
                {field.label}
              </DropdownMenuCheckboxItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MoreViewsCount({ count }: { count: number }): React.JSX.Element {
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-semibold text-foreground tabular-nums">
      {count}
    </span>
  );
}

function MoreViewsMenu({
  views,
  overflowBuiltIns,
  onManage,
}: {
  views: ListViewsModel;
  overflowBuiltIns: readonly ListViewEntry[];
  onManage: () => void;
}): React.JSX.Element {
  // What More views lists that is not a tab right now (§5.1).
  const count =
    overflowBuiltIns.length +
    views.savedViews.filter((view) => view.id !== views.appliedId).length;
  const entry = (view: ListViewEntry): React.JSX.Element => {
    const current = view.id === views.appliedId;
    return (
      <DropdownMenuItem
        key={view.id}
        aria-current={current ? "page" : undefined}
        onSelect={() => views.onApply(view.id)}
        className="gap-2"
      >
        <Check
          aria-hidden="true"
          className={cn("size-4 shrink-0", !current && "invisible")}
        />
        <span className="min-w-0 flex-1 truncate">{view.name}</span>
        {views.offersDefault && views.defaultViewId === view.id ? (
          <span className="pl-3 text-xs text-muted-foreground">Default</span>
        ) : null}
      </DropdownMenuItem>
    );
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={tabClass}
        data-testid="list-more-views"
      >
        More views
        {count > 0 ? (
          <>
            <span className="sr-only">, {count}</span>
            <span aria-hidden="true">
              <MoreViewsCount count={count} />
            </span>
          </>
        ) : null}
        <ChevronDown aria-hidden="true" className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {overflowBuiltIns.map(entry)}
        {/* The Saved Views section shows once there is something to manage
            (§10.8): a Saved View, or the Default View on the main page. */}
        {offersManageViews(views) ? (
          <>
            {overflowBuiltIns.length > 0 ? <DropdownMenuSeparator /> : null}
            <DropdownMenuLabel>Saved views</DropdownMenuLabel>
            {views.savedViews.length > 0 ? (
              views.savedViews.map(entry)
            ) : (
              <p className="px-2 py-1.5 text-sm text-muted-foreground">
                No saved views yet
              </p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onManage} className="pl-8">
              Manage views…
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EditControls({
  views,
  compact,
  onSaveChanges,
  onSaveAsNew,
}: {
  views: ListViewsModel;
  /** Discard changes reads "Discard" when the header is crowded. */
  compact: boolean;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
}): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-outline-variant" />
      {views.canSave ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md border border-primary bg-primary/10 px-2.5 text-sm font-semibold text-primary hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            data-testid="list-save-view"
          >
            Save
            <ChevronDown aria-hidden="true" className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {views.appliedIsSaved ? (
              <DropdownMenuItem onSelect={onSaveChanges}>
                Save changes
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={onSaveAsNew}>
              Save as new…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <button
        type="button"
        onClick={views.onDiscard}
        aria-label={compact ? "Discard changes" : undefined}
        className="h-7 rounded-md px-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {compact ? "Discard" : "Discard changes"}
      </button>
    </span>
  );
}

interface ListHeaderProps {
  views: ListViewsModel;
  sort: ListSortModel;
  pagination: ListPaginationModel;
  display: ListDisplayModel;
  /** Export, when the host offers it (§5.5). */
  exportControl?: React.ReactNode;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
  onManage: () => void;
}

/**
 * The desktop List Header (list-views §5, §8.2, §8.3): Built-in Views as
 * tabs in a "Saved views" navigation landmark (§12.3), More views, Edited
 * with Save and Discard changes, then the compact pager, sort, Export, and
 * View options. Hidden below md, where the phone header takes over (§7.3).
 */
export function ListHeader({
  views,
  sort,
  pagination,
  display,
  exportControl,
  onSaveChanges,
  onSaveAsNew,
  onManage,
}: ListHeaderProps): React.JSX.Element {
  const rowRef = React.useRef<HTMLDivElement>(null);
  // A Saved View shows as a tab while it is applied (§5.1).
  const appliedSaved = views.appliedIsSaved
    ? (views.savedViews.find((view) => view.id === views.appliedId) ?? null)
    : null;
  const tabs = appliedSaved
    ? [...views.builtInViews, appliedSaved]
    : [...views.builtInViews];
  const appliedIndex = Math.max(
    0,
    tabs.findIndex((view) => view.id === views.appliedId)
  );
  // More views always holds the Saved Views section once there is anything
  // to manage; otherwise it shows only for Built-in Views that do not fit.
  const moreViewsAlways = offersManageViews(views);
  const contentKey = [
    ...tabs.map((tab) => tab.name),
    views.appliedId,
    String(views.edited),
    String(views.canSave),
    String(moreViewsAlways),
    sort.label,
    String(pagination.totalCount),
    String(pagination.page),
    String(pagination.pageSize),
  ].join("|");
  const measured = useMeasuredWidths(rowRef, rowRef, contentKey);
  const width = (key: string): number => measured?.widths[key] ?? 0;
  // A header that is not laid out (display: none below md) measures zero
  // and keeps every tab until it is shown.
  const plan =
    measured && measured.available > 0
      ? planListHeader({
          available: measured.available,
          tabWidths: tabs.map((_, index) => width(`tab-${index}`)),
          appliedIndex,
          moreViewsWidth: width("more-views"),
          moreViewsAlways,
          editWidth: views.edited ? width("edit") : 0,
          editCompactWidth: views.edited ? width("edit-compact") : 0,
          pagerWidths: {
            full: width("pager-full"),
            compact: width("pager-compact"),
          },
          controlsWidth: width("controls"),
          gap: GAP,
        })
      : {
          visibleTabs: tabs.map((_, index) => index),
          showMoreViews: moreViewsAlways,
          pager: "full" as const,
          compactEdit: false,
        };
  const visible = new Set(plan.visibleTabs);
  const overflowBuiltIns = views.builtInViews.filter(
    (_, index) => !visible.has(index)
  );
  const showMoreViews = plan.showMoreViews || overflowBuiltIns.length > 0;

  const controls = (
    <>
      <SortMenu sort={sort} />
      {exportControl}
      <ViewOptionsMenu display={display} />
    </>
  );

  return (
    <div
      ref={rowRef}
      className="relative hidden min-h-12 items-center justify-between gap-0.5 border-b border-outline-variant bg-muted/40 px-2.5 py-1.5 md:flex"
    >
      <nav
        aria-label="Saved views"
        className="flex min-w-0 items-center gap-0.5"
      >
        {tabs.map((tab, index) => {
          if (!visible.has(index)) return null;
          const current = tab.id === views.appliedId;
          return (
            // Only the Applied View's tab may shrink, truncating its name,
            // once nothing else is left to move (§8.2).
            <Link
              key={tab.id}
              href={views.hrefFor(tab.id)}
              prefetch={false}
              scroll={false}
              aria-current={current ? "page" : undefined}
              onClick={(event) => {
                if (!isPlainClick(event)) return;
                event.preventDefault();
                views.onApply(tab.id);
              }}
              className={cn(
                tabClass,
                current && currentTabClass,
                current && "min-w-0 shrink"
              )}
            >
              <TabFace name={tab.name} edited={current && views.edited} />
            </Link>
          );
        })}
        {showMoreViews ? (
          <MoreViewsMenu
            views={views}
            overflowBuiltIns={overflowBuiltIns}
            onManage={onManage}
          />
        ) : null}
        {views.edited ? (
          <EditControls
            views={views}
            compact={plan.compactEdit}
            onSaveChanges={onSaveChanges}
            onSaveAsNew={onSaveAsNew}
          />
        ) : null}
      </nav>
      <div className="flex shrink-0 items-center">
        {plan.pager !== "hidden" ? (
          <>
            <CompactPager
              pagination={pagination}
              showRange={plan.pager === "full"}
            />
            <span
              aria-hidden="true"
              className="mx-1.5 h-5 w-px bg-outline-variant"
            />
          </>
        ) : null}
        <div data-measure="controls" className="flex items-center gap-0.5">
          {controls}
        </div>
      </div>

      {/* Exact widths of the controls that come and go, as static faces
          kept out of the accessibility tree and clipped so they never widen
          the page (CORE-RESP-002 boundary). The live sort, Export, and View
          options group measures itself. */}
      <div
        aria-hidden="true"
        className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
      >
        {tabs.map((tab, index) => (
          <span
            key={tab.id}
            data-measure={`tab-${index}`}
            className={cn(
              "absolute w-max",
              tabClass,
              tab.id === views.appliedId && currentTabClass
            )}
          >
            <TabFace
              name={tab.name}
              edited={tab.id === views.appliedId && views.edited}
            />
          </span>
        ))}
        <span
          data-measure="more-views"
          className={cn("absolute w-max", tabClass)}
        >
          More views
          <MoreViewsCount count={9} />
          <ChevronDown className="size-3.5" />
        </span>
        <span data-measure="edit" className="absolute flex w-max items-center">
          <span className="mx-1.5 h-5 w-px" />
          {views.canSave ? (
            <span className="inline-flex h-7 items-center gap-1 border px-2.5 text-sm font-semibold">
              Save
              <ChevronDown className="size-3.5" />
            </span>
          ) : null}
          <span className="ml-1 px-2 text-sm">Discard changes</span>
        </span>
        <span
          data-measure="edit-compact"
          className="absolute flex w-max items-center"
        >
          <span className="mx-1.5 h-5 w-px" />
          {views.canSave ? (
            <span className="inline-flex h-7 items-center gap-1 border px-2.5 text-sm font-semibold">
              Save
              <ChevronDown className="size-3.5" />
            </span>
          ) : null}
          <span className="ml-1 px-2 text-sm">Discard</span>
        </span>
        <span data-measure="pager-full" className="absolute flex w-max">
          <span className="pr-1 pl-0.5">
            <RangeTextFace pagination={pagination} />
          </span>
          <span className="size-8" />
          <span className="size-8" />
          <span className="mx-1.5 h-5 w-px" />
        </span>
        <span data-measure="pager-compact" className="absolute flex w-max">
          <span className="size-8" />
          <span className="size-8" />
          <span className="mx-1.5 h-5 w-px" />
        </span>
      </div>
    </div>
  );
}
