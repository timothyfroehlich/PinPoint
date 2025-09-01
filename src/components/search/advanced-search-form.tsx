/**
 * Advanced Search Form Component
 * Phase 3C: Reusable faceted search interface with Server Actions
 *
 * Provides comprehensive search and filtering capabilities for Issues and Machines
 * with URL state integration and progressive enhancement
 */

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";

// Generic filter configuration interface
export interface FilterField {
  id: string;
  label: string;
  type:
    | "text"
    | "select"
    | "multi-select"
    | "date-range"
    | "boolean"
    | "number-range";
  options?: { value: string; label: string; count?: number }[];
  placeholder?: string;
  min?: number;
  max?: number;
}

export interface AdvancedSearchFormProps {
  // Core configuration
  entityType: "issues" | "machines" | "universal";
  fields: FilterField[];

  // Current search state from URL
  currentParams: Record<string, string | string[] | undefined>;

  // URL building functions - using unknown for type safety
  buildUrl: (params: Record<string, unknown>) => string;

  // Optional customization
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  showActiveFilters?: boolean;

  // Event handlers - using unknown for type safety
  onFormSubmit?: (params: Record<string, unknown>) => void;
}

// Form state type - using unknown for type safety
type FormState = Record<string, unknown>;

export function AdvancedSearchForm({
  entityType,
  fields,
  currentParams,
  buildUrl,
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
  const [formState, setFormState] = useState<FormState>(() => {
    // Initialize form state from current URL parameters
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
  });

  // Handle form field updates
  const updateFormField = (fieldId: string, value: unknown) => {
    setFormState((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Handle form submission with URL update
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    // Build clean parameters object
    const params: Record<string, unknown> = {};

    fields.forEach((field) => {
      if (field.type === "multi-select") {
        const values = formState[field.id] as string[];
        if (Array.isArray(values) && values.length > 0) {
          params[field.id] = values;
        }
      } else if (field.type === "date-range") {
        const start = formState[`${field.id}_start`];
        const end = formState[`${field.id}_end`];
        if (start && typeof start === "string")
          params[`${field.id}_start`] = start;
        if (end && typeof end === "string") params[`${field.id}_end`] = end;
      } else if (field.type === "number-range") {
        const min = formState[`${field.id}_min`];
        const max = formState[`${field.id}_max`];
        if (min && (typeof min === "string" || typeof min === "number"))
          params[`${field.id}_min`] = min;
        if (max && (typeof max === "string" || typeof max === "number"))
          params[`${field.id}_max`] = max;
      } else if (field.type === "boolean") {
        if (formState[field.id] === true) {
          params[field.id] = "true";
        }
      } else {
        const value = formState[field.id];
        if (
          value &&
          value !== "" &&
          (typeof value === "string" || typeof value === "number")
        ) {
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
  };

  // Clear all filters
  const handleClearFilters = () => {
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
  };

  // Count active filters for display
  const activeFilterCount = fields.reduce((count, field) => {
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

  // Render individual form field
  const renderField = (field: FilterField) => {
    switch (field.type) {
      case "text":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Input
              id={field.id}
              type="text"
              placeholder={field.placeholder}
              value={formState[field.id] ?? ""}
              onChange={(e) => {
                updateFormField(field.id, e.target.value);
              }}
            />
          </div>
        );

      case "select":
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Select
              value={formState[field.id] ?? ""}
              onValueChange={(value) => {
                updateFormField(field.id, value);
              }}
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
          <div key={field.id} className="space-y-2">
            <Label>{field.label}</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {field.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.id}-${option.value}`}
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={(checked) => {
                      const newValues = checked
                        ? [...selectedValues, option.value]
                        : selectedValues.filter((v) => v !== option.value);
                      updateFormField(field.id, newValues);
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
          <div key={field.id} className="space-y-2">
            <Label>{field.label}</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="date"
                  placeholder="Start date"
                  value={formState[`${field.id}_start`] ?? ""}
                  onChange={(e) => {
                    updateFormField(`${field.id}_start`, e.target.value);
                  }}
                />
              </div>
              <div className="flex-1">
                <Input
                  type="date"
                  placeholder="End date"
                  value={formState[`${field.id}_end`] ?? ""}
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
          <div key={field.id} className="space-y-2">
            <Label>{field.label}</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder={`Min ${field.label.toLowerCase()}`}
                  min={field.min}
                  max={field.max}
                  value={formState[`${field.id}_min`] ?? ""}
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
                  value={formState[`${field.id}_max`] ?? ""}
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
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={formState[field.id] === true}
              onCheckedChange={(checked) => {
                updateFormField(field.id, checked === true);
              }}
            />
            <Label htmlFor={field.id}>{field.label}</Label>
          </div>
        );

      default:
        return null;
    }
  };

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
                  {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
                  active
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
            {fields.map(renderField)}
          </div>

          <Separator />

          {/* Form actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {showActiveFilters && activeFilterCount > 0 && (
                <Badge variant="outline">
                  {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
                  applied
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
}
