"use client";
import React, {
  useState,
  useMemo,
  useActionState,
  useEffect,
  useRef,
} from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Button } from "~/components/ui/button";
import { UserCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitPublicIssueAction } from "./actions";
import { SeveritySelect } from "~/components/issues/fields/SeveritySelect";
import { FrequencySelect } from "~/components/issues/fields/FrequencySelect";
import { PrioritySelect } from "~/components/issues/fields/PrioritySelect";
import { StatusSelect } from "~/components/issues/fields/StatusSelect";
import type {
  IssueSeverity,
  IssueFrequency,
  IssuePriority,
  IssueStatus,
} from "~/lib/types";
import { ImageUploadButton } from "~/components/images/ImageUploadButton";
import { ImageGallery } from "~/components/images/ImageGallery";
import { type ImageMetadata } from "~/types/images";

interface Machine {
  id: string;
  name: string;
  initials: string;
}

interface UserProfile {
  role: string;
}

interface User {
  email?: string;
}

export interface ActionState {
  error?: string;
  success?: boolean;
}

interface UnifiedReportFormProps {
  machinesList: Machine[];
  defaultMachineId?: string;
  user: User | null; // Supabase User
  userProfile?: UserProfile | undefined;
  initialError?: string | undefined;
  recentIssuesPanelMobile?: React.ReactNode;
  recentIssuesPanelDesktop?: React.ReactNode;
}

export function UnifiedReportForm({
  machinesList,
  defaultMachineId,
  user,
  userProfile,
  initialError,
  recentIssuesPanelMobile,
  recentIssuesPanelDesktop,
}: UnifiedReportFormProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasRestored = useRef(false);
  const [selectedMachineId, setSelectedMachineId] = useState(
    defaultMachineId ?? ""
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<IssueSeverity | "">("minor");
  const [priority, setPriority] = useState<IssuePriority | "">("medium");
  const [frequency, setFrequency] = useState<IssueFrequency | "">("constant");
  const [status, setStatus] = useState<IssueStatus>("new");

  const [uploadedImages, setUploadedImages] = useState<ImageMetadata[]>([]);

  const [state, formAction, isPending] = useActionState(
    submitPublicIssueAction,
    {}
  );

  const selectedMachine = useMemo(
    () => machinesList.find((m) => m.id === selectedMachineId),
    [machinesList, selectedMachineId]
  );

  // Clear localStorage on successful submission
  useEffect(() => {
    if (state.success) {
      window.localStorage.removeItem("report_form_state");
    }
  }, [state.success]);

  // Persistence: Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || hasRestored.current) return;
    hasRestored.current = true;

    // If a specific machine is requested via URL, treat as a new report and clear any draft
    if (defaultMachineId) {
      window.localStorage.removeItem("report_form_state");
      return;
    }

    const saved = window.localStorage.getItem("report_form_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<{
          machineId: string;
          title: string;
          description: string;
          severity: IssueSeverity | "";
          priority: IssuePriority | "";
          frequency: IssueFrequency | "";
        }>;

        // Only restore machineId if not provided via prop or URL already
        // AND if we have a valid machineId in storage
        if (parsed.machineId && !defaultMachineId) {
          setSelectedMachineId(parsed.machineId);
          // Sync to URL if we restored it from localStorage
          const machine = machinesList.find((m) => m.id === parsed.machineId);
          if (machine) {
            const params = new URLSearchParams(searchParams.toString());
            params.set("machine", machine.initials);
            router.replace(`?${params.toString()}`, { scroll: false });
          }
        }

        if (parsed.title) setTitle(parsed.title);
        if (parsed.description) setDescription(parsed.description);
        if (parsed.severity) setSeverity(parsed.severity);
        if (parsed.priority) setPriority(parsed.priority);
        if (parsed.frequency) setFrequency(parsed.frequency);
      } catch {
        // Clear corrupted localStorage
        window.localStorage.removeItem("report_form_state");
      }
    }
  }, [defaultMachineId, machinesList, router, searchParams]);

  // Persistence: Save to localStorage on change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stateToSave = {
      machineId: selectedMachineId,
      title,
      description,
      severity,
      priority,
      frequency,
    };
    window.localStorage.setItem(
      "report_form_state",
      JSON.stringify(stateToSave)
    );
  }, [selectedMachineId, title, description, severity, priority, frequency]);

  // Cleanup: Clear storage on success (handled by redirect usually, but good for robust logic if no redirect)
  // Actually, review says: "cleanup effect will never execute because action redirects".
  // Removing it to follow advice.

  // Sync with defaultMachineId prop when it changes (from URL)
  useEffect(() => {
    if (defaultMachineId) {
      setSelectedMachineId(defaultMachineId);
    }
  }, [defaultMachineId]);

  const isAdminOrMember =
    user && (userProfile?.role === "admin" || userProfile?.role === "member");

  return (
    <div className="w-full max-w-5xl mx-auto">
      <Card className="border-outline-variant bg-surface shadow-md">
        <CardHeader className="space-y-1.5 pb-4 border-b border-outline-variant/50">
          <CardTitle className="text-2xl font-bold text-on-surface">
            Report an Issue
          </CardTitle>
          <p className="text-sm text-on-surface-variant">
            Tell us what&apos;s going on and the maintenance crew will take it
            from here.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Main Form Column */}
            <div className="lg:col-span-7 space-y-4">
              {(initialError ?? state.error) && (
                <div
                  role="alert"
                  className="rounded-md border border-red-900/50 bg-red-900/20 px-4 py-2 text-sm text-red-300"
                >
                  {initialError ?? state.error}
                </div>
              )}

              <form action={formAction} className="space-y-4">
                {/* Honeypot field for bot detection */}
                <input
                  type="text"
                  name="website"
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                />
                <div className="space-y-1.5">
                  <Label htmlFor="machineId" className="text-on-surface">
                    Machine *
                  </Label>
                  <select
                    id="machineId"
                    name="machineId"
                    data-testid="machine-select"
                    aria-label="Select Machine"
                    required
                    value={selectedMachineId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedMachineId(newId);
                      // Update URL for parent to re-render Server Components
                      const machine = machinesList.find((m) => m.id === newId);
                      if (machine) {
                        const params = new URLSearchParams(
                          searchParams.toString()
                        );
                        params.set("machine", machine.initials);
                        router.push(`?${params.toString()}`, { scroll: false });
                      }
                    }}
                    className="w-full rounded-md border border-outline-variant bg-surface px-3 h-9 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  >
                    <option value="" disabled>
                      Select a machine...
                    </option>
                    {machinesList.map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} ({machine.initials})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Mobile Recent Issues (Compact) - Visible only on small screens */}
                <div className="lg:hidden">{recentIssuesPanelMobile}</div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="title" className="text-on-surface">
                      Issue Title *
                    </Label>
                    {title.length >= 40 && (
                      <span className="text-xs text-muted-foreground">
                        {60 - title.length}/60
                      </span>
                    )}
                  </div>
                  <Input
                    id="title"
                    name="title"
                    required
                    maxLength={60}
                    placeholder="e.g., Left flipper not responding"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-9 border-outline-variant bg-surface text-on-surface focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-on-surface">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={3}
                    placeholder="Tell us what happened, and how often it occurs."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-[80px] border-outline-variant bg-surface text-on-surface focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="severity" className="text-on-surface">
                      Severity *
                    </Label>
                    <input type="hidden" name="severity" value={severity} />
                    <SeveritySelect
                      value={severity}
                      onValueChange={setSeverity}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="frequency" className="text-on-surface">
                      Frequency *
                    </Label>
                    <input type="hidden" name="frequency" value={frequency} />
                    <FrequencySelect
                      value={frequency}
                      onValueChange={setFrequency}
                      testId="issue-frequency-select"
                    />
                  </div>

                  {isAdminOrMember && (
                    <div className="space-y-1.5">
                      <Label htmlFor="priority" className="text-on-surface">
                        Priority *
                      </Label>
                      <input type="hidden" name="priority" value={priority} />
                      <PrioritySelect
                        value={priority}
                        onValueChange={setPriority}
                      />
                    </div>
                  )}
                  {isAdminOrMember && (
                    <div className="space-y-1.5">
                      <Label htmlFor="status" className="text-on-surface">
                        Status *
                      </Label>
                      <input type="hidden" name="status" value={status} />
                      <StatusSelect value={status} onValueChange={setStatus} />
                    </div>
                  )}
                </div>

                <div className="space-y-3 pb-2 pt-1 border-t border-b border-outline-variant/30 py-4">
                  <div className="flex flex-col gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-on-surface">Photos</Label>
                      <ImageUploadButton
                        issueId="new"
                        currentCount={uploadedImages.length}
                        maxCount={user ? 4 : 2}
                        onUploadComplete={(img) =>
                          setUploadedImages((prev) => [...prev, img])
                        }
                        disabled={isPending}
                      />
                    </div>

                    {uploadedImages.length > 0 && (
                      <div className="mt-2">
                        <ImageGallery
                          images={uploadedImages.map((img) => ({
                            id: img.blobPathname,
                            fullImageUrl: img.blobUrl,
                            originalFilename: img.originalFilename,
                          }))}
                        />
                      </div>
                    )}
                    <input
                      type="hidden"
                      name="imagesMetadata"
                      value={JSON.stringify(uploadedImages)}
                    />
                  </div>
                </div>

                {/* Reporter Info (Only if NOT logged in) */}
                {!user ? (
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-on-surface">
                        Your Information (Optional)
                      </h3>
                    </div>
                    <div className="space-y-3 rounded-lg border border-outline-variant/30 bg-surface-container-low p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="firstName"
                            className="text-xs text-on-surface"
                          >
                            First Name
                          </Label>
                          <Input
                            id="firstName"
                            name="firstName"
                            className="h-8 border-outline-variant bg-surface text-sm text-on-surface"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label
                            htmlFor="lastName"
                            className="text-xs text-on-surface"
                          >
                            Last Name
                          </Label>
                          <Input
                            id="lastName"
                            name="lastName"
                            className="h-8 border-outline-variant bg-surface text-sm text-on-surface"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="email"
                          className="text-xs text-on-surface"
                        >
                          Email Address
                        </Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          className="h-8 border-outline-variant bg-surface text-sm text-on-surface"
                        />
                        <p className="text-[10px] text-on-surface-variant">
                          Verified emails link to your profile.
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-on-surface-variant">
                      Already have an account?{" "}
                      <Link
                        href={`/login?redirect=${encodeURIComponent(
                          selectedMachine
                            ? `/report?machine=${selectedMachine.initials}`
                            : "/report"
                        )}`}
                        className="text-primary hover:underline"
                      >
                        Log in
                      </Link>
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-surface-container-high px-3 py-2 text-xs text-on-surface-variant mt-2">
                    <UserCheck className="h-4 w-4 text-primary" />
                    <span>Logged in</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary text-on-primary hover:bg-primary/90 mt-2 h-10 text-sm font-semibold"
                  loading={isPending}
                >
                  Submit Issue Report
                </Button>
              </form>
            </div>

            {/* Right Sidebar: Recent Issues (Desktop) */}
            <div className="hidden lg:block lg:col-span-5 border-l border-outline-variant/50 pl-8">
              {recentIssuesPanelDesktop}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
