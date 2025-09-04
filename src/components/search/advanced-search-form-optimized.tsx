/**
 * Performance-Optimized Advanced Search Form
 * Phase 3C: Memoized and code-split search form for better bundle size
 */

"use client";

import { useState, useTransition, useMemo, useCallback, memo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Filter, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import {
  type FilterField,
  type AdvancedSearchFormProps,
} from "./advanced-search-form";
import { buildIssueUrl } from "~/lib/search-params/issue-search-params";
import { buildMachineUrl } from "~/lib/search-params/machine-search-params";

// Lazy load heavy components for better initial bundle size
const Checkbox = dynamic(
  () =>
    import("~/components/ui/checkbox").then((mod) => ({
      default: mod.Checkbox,
    })),
  {
    loading: () => <div className="h-4 w-4 animate-pulse bg-muted rounded" />,
  },
);

type FormState = Record<string, unknown>;

// Memoized field renderer for performance
const MemoizedFieldRenderer = memo(function FieldRenderer({
  field,
  formState,
  updateFormField,
}: {
  field: FilterField;
  formState: FormState;
  updateFormField: (fieldId: string, value: unknown) => void;
}) {
  // Memoize callbacks to prevent unnecessary re-renders
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateFormField(field.id, e.target.value);
    },
    [field.id, updateFormField],
  );

  const handleSelectChange = useCallback(
    (value: string) => {
      updateFormField(field.id, value);
    },
    [field.id, updateFormField],
  );

  const handleCheckboxChange = useCallback(
    (checked: boolean) => {
      updateFormField(field.id, checked);
    },
    [field.id, updateFormField],
  );

  const handleMultiSelectChange = useCallback(
    (optionValue: string, checked: boolean) => {
      const selectedValues = formState[field.id] as string[];
      const newValues = checked
        ? [...selectedValues, optionValue]
        : selectedValues.filter((v) => v !== optionValue);
      updateFormField(field.id, newValues);
    },
    [field.id, formState, updateFormField],
  );

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input
            id={field.id}
            type="text"
            placeholder={field.placeholder}
            value={(formState[field.id] as string) || ""}
            onChange={handleTextChange}
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label htmlFor={field.id}>{field.label}</Label>
          <Select
            value={(formState[field.id] as string) || ""}
            onValueChange={handleSelectChange}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  field.placeholder ?? `Select ${field.label.toLowerCase()}`
                }
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <Badge variant="secondary" className="ml-2 text-xs">
                        {option.count}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "multi-select":
      const selectedValues = formState[field.id] as string[];
      return (
        <div className="space-y-2">
          <Label>{field.label}</Label>
          <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${field.id}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    handleMultiSelectChange(option.value, checked as boolean);
                  }}
                />
                <Label
                  htmlFor={`${field.id}-${option.value}`}
                  className="flex-1 flex items-center justify-between cursor-pointer"
                >
                  <span>{option.label}</span>
                  {option.count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {option.count}
                    </Badge>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </div>
      );

    case "date-range":
      return (
        <div className="space-y-2">
          <Label>{field.label}</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="date"
                placeholder="Start date"
                value={(formState[`${field.id}_start`] as string) || ""}
                onChange={(e) => {
                  updateFormField(`${field.id}_start`, e.target.value);
                }}
              />
            </div>
            <div className="flex-1">
              <Input
                type="date"
                placeholder="End date"
                value={(formState[`${field.id}_end`] as string) || ""}
                onChange={(e) => {
                  updateFormField(`${field.id}_end`, e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      );

    case "number-range":
      return (
        <div className="space-y-2">
          <Label>{field.label}</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                placeholder={`Min ${field.label.toLowerCase()}`}
                min={field.min}
                max={field.max}
                value={(formState[`${field.id}_min`] as string) || ""}
                onChange={(e) => {
                  updateFormField(`${field.id}_min`, e.target.value);
                }}
              />
            </div>
            <div className="flex-1">
              <Input
                type="number"
                placeholder={`Max ${field.label.toLowerCase()}`}
                min={field.min}
                max={field.max}
                value={(formState[`${field.id}_max`] as string) || ""}
                onChange={(e) => {
                  updateFormField(`${field.id}_max`, e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      );

    case "boolean":
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={field.id}
            checked={formState[field.id] === true}
            onCheckedChange={handleCheckboxChange}
          />
          <Label htmlFor={field.id}>{field.label}</Label>
        </div>
      );

    default:
      return null;
  }
});

// Main optimized component
export const AdvancedSearchFormOptimized = memo(
  function AdvancedSearchFormOptimized({
    entityType,
    fields,
    currentParams,
    basePath,
    buildUrl: externalBuildUrl,
    title,
    description,
    collapsible = true,
    defaultExpanded = false,
    showActiveFilters = true,
    onFormSubmit,
  }: AdvancedSearchFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // Form state management
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Helper function to build URLs based on entity type
    const buildUrl = useCallback((params: Record<string, unknown>): string => {
      // Use external buildUrl function if provided, otherwise use internal logic
      if (externalBuildUrl) {
        return externalBuildUrl(params);
      }
      
      if (entityType === "issues") {
        return buildIssueUrl(basePath, params, currentParams);
      } else if (entityType === "machines") {
        return buildMachineUrl(basePath, params, currentParams);
      } else {
        // fallback for universal or other types - you could extend this
        throw new Error(
          `URL building not implemented for entityType: ${entityType}`,
        );
      }
    }, [externalBuildUrl, entityType, basePath, currentParams]);

    // Memoize initial form state to prevent unnecessary recalculations
    const initialFormState = useMemo(() => {
      const initialState: FormState = {};

      fields.forEach((field) => {
        const currentValue = currentParams[field.id];

        if (field.type === "multi-select") {
          initialState[field.id] = Array.isArray(currentValue)
            ? currentValue
            : typeof currentValue === "string"
              ? currentValue.split(",").filter(Boolean)
              : [];
        } else if (field.type === "date-range") {
          initialState[`${field.id}_start`] =
            currentParams[`${field.id}_start`] ?? "";
          initialState[`${field.id}_end`] =
            currentParams[`${field.id}_end`] ?? "";
        } else if (field.type === "number-range") {
          initialState[`${field.id}_min`] =
            currentParams[`${field.id}_min`] ?? "";
          initialState[`${field.id}_max`] =
            currentParams[`${field.id}_max`] ?? "";
        } else if (field.type === "boolean") {
          initialState[field.id] = currentValue === "true";
        } else {
          initialState[field.id] = currentValue ?? "";
        }
      });

      return initialState;
    }, [fields, currentParams]);

    const [formState, setFormState] = useState<FormState>(initialFormState);

    // Memoized callbacks to prevent re-renders
    const updateFormField = useCallback((fieldId: string, value: unknown) => {
      setFormState((prev) => ({
        ...prev,
        [fieldId]: value,
      }));
    }, []);

    // Memoized active filter count calculation
    const activeFilterCount = useMemo(() => {
      return fields.reduce((count, field) => {
        if (field.type === "multi-select") {
          const values = formState[field.id] as string[];
          return count + values.length;
        } else if (field.type === "date-range") {
          const hasStart = formState[`${field.id}_start`];
          const hasEnd = formState[`${field.id}_end`];
          return count + (hasStart ? 1 : 0) + (hasEnd ? 1 : 0);
        } else if (field.type === "number-range") {
          const hasMin = formState[`${field.id}_min`];
          const hasMax = formState[`${field.id}_max`];
          return count + (hasMin ? 1 : 0) + (hasMax ? 1 : 0);
        } else if (field.type === "boolean") {
          return count + (formState[field.id] === true ? 1 : 0);
        } else {
          return count + (formState[field.id] ? 1 : 0);
        }
      }, 0);
    }, [fields, formState]);

    // Memoized form submission handler
    const handleSubmit = useCallback(
      (event: React.FormEvent) => {
        event.preventDefault();

        // Build clean parameters object
        const params: Record<string, unknown> = {};

        fields.forEach((field) => {
          if (field.type === "multi-select") {
            const values = formState[field.id] as string[];
            if (values.length > 0) {
              params[field.id] = values;
            }
          } else if (field.type === "date-range") {
            const start = formState[`${field.id}_start`];
            const end = formState[`${field.id}_end`];
            if (start) params[`${field.id}_start`] = start;
            if (end) params[`${field.id}_end`] = end;
          } else if (field.type === "number-range") {
            const min = formState[`${field.id}_min`];
            const max = formState[`${field.id}_max`];
            if (min) params[`${field.id}_min`] = min;
            if (max) params[`${field.id}_max`] = max;
          } else if (field.type === "boolean") {
            if (formState[field.id] === true) {
              params[field.id] = "true";
            }
          } else {
            const value = formState[field.id];
            if (value && value !== "") {
              params[field.id] = value;
            }
          }
        });

        // Reset to page 1 when applying new filters
        params["page"] = 1;

        // Custom form submit handler
        if (onFormSubmit) {
          onFormSubmit(params);
          return;
        }

        // Default URL navigation
        const newUrl = buildUrl(params);
        startTransition(() => {
          router.push(newUrl);
        });
      },
      [fields, formState, onFormSubmit, buildUrl, router],
    );

    // Memoized clear filters handler
    const handleClearFilters = useCallback(() => {
      const clearedState: FormState = {};

      fields.forEach((field) => {
        if (field.type === "multi-select") {
          clearedState[field.id] = [];
        } else if (field.type === "date-range") {
          clearedState[`${field.id}_start`] = "";
          clearedState[`${field.id}_end`] = "";
        } else if (field.type === "number-range") {
          clearedState[`${field.id}_min`] = "";
          clearedState[`${field.id}_max`] = "";
        } else if (field.type === "boolean") {
          clearedState[field.id] = false;
        } else {
          clearedState[field.id] = "";
        }
      });

      setFormState(clearedState);

      // Navigate to clean URL
      startTransition(() => {
        router.push(buildUrl({ page: 1 }));
      });
    }, [fields, buildUrl, router]);

    if (collapsible && !isExpanded) {
      return (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">
                    {title ?? `Advanced ${entityType} Search`}
                  </CardTitle>
                  {description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">
                    {activeFilterCount} filter
                    {activeFilterCount !== 1 ? "s" : ""} active
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsExpanded(true);
                  }}
                  className="flex items-center gap-1"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show Filters
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      );
    }

    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <div>
                <CardTitle className="text-lg">
                  {title ?? `Advanced ${entityType} Search`}
                </CardTitle>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {description}
                  </p>
                )}
              </div>
            </div>
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsExpanded(false);
                }}
                className="flex items-center gap-1"
              >
                <ChevronUp className="h-4 w-4" />
                Hide Filters
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Render form fields in a responsive grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {fields.map((field) => (
                <MemoizedFieldRenderer
                  key={field.id}
                  field={field}
                  formState={formState}
                  updateFormField={updateFormField}
                />
              ))}
            </div>

            <Separator />

            {/* Form actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {showActiveFilters && activeFilterCount > 0 && (
                  <Badge variant="outline">
                    {activeFilterCount} filter
                    {activeFilterCount !== 1 ? "s" : ""} applied
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClearFilters}
                  disabled={isPending || activeFilterCount === 0}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>

                <Button
                  type="submit"
                  disabled={isPending}
                  className="min-w-[120px]"
                >
                  {isPending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-1" />
                      Apply Filters
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  },
);

export default AdvancedSearchFormOptimized;
