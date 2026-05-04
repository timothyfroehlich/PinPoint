"use client";
import React, {
  useState,
  useMemo,
  useActionState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { useSearchParams } from "next/navigation";
import { cn } from "~/lib/utils";
import {
  submitPublicIssueAction,
  getRecentIssuesAction,
  type RecentIssueData,
} from "./actions";
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
import type { AccessLevel } from "~/lib/permissions/matrix";
import { TurnstileWidget } from "~/components/security/TurnstileWidget";
import { getLoginUrl } from "~/lib/login-url";
import { RecentIssuesPanelClient } from "~/components/issues/RecentIssuesPanelClient";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { type ProseMirrorDoc } from "~/lib/tiptap/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

interface Machine {
  id: string;
  name: string;
  initials: string;
}

export interface ActionState {
  error?: string;
  success?: boolean;
  redirectTo?: string;
}

interface Assignee {
  id: string;
  name: string | null;
}

interface UnifiedReportFormProps {
  machinesList: Machine[];
  defaultMachineId?: string | undefined;
  userAuthenticated: boolean;
  accessLevel: AccessLevel;
  assignees?: Assignee[];
  initialError?: string | undefined;
  initialIssues: RecentIssueData[] | null;
  initialMachineInitials: string;
}

export function UnifiedReportForm({
  machinesList,
  defaultMachineId,
  userAuthenticated,
  accessLevel,
  assignees = [],
  initialError,
  initialIssues,
  initialMachineInitials,
}: UnifiedReportFormProps): React.JSX.Element {
  const searchParams = useSearchParams();
  const hasRestored = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  // Bumped to remount the Turnstile widget on reset — its internal "solved"
  // state is otherwise out of sync with the cleared hidden token.
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0);
  const [selectedMachineId, setSelectedMachineId] = useState(
    defaultMachineId ?? ""
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<ProseMirrorDoc | null>(null);
  const [severity, setSeverity] = useState<IssueSeverity | "">("minor");
  const [priority, setPriority] = useState<IssuePriority | "">("medium");
  const [frequency, setFrequency] = useState<IssueFrequency | "">("constant");
  const [status, setStatus] = useState<IssueStatus>("new");
  const [assignedTo, setAssignedTo] = useState("");
  const [watchIssue, setWatchIssue] = useState(true);

  const [uploadedImages, setUploadedImages] = useState<ImageMetadata[]>([]);
  const [turnstileToken, setTurnstileToken] = useState("");
  // CAPTCHA is only required for anonymous reporters. Logged-in users skip it
  // both client-side (no widget rendered) and server-side (action checks
  // auth.getUser() before calling verifyTurnstileToken).
  const hasTurnstile = Boolean(process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"]);
  const enforceCaptcha =
    hasTurnstile && process.env.NODE_ENV !== "test" && !userAuthenticated;

  // Recent issues panel state
  const [issues, setIssues] = useState<RecentIssueData[]>(initialIssues ?? []);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesError, setIssuesError] = useState(
    initialIssues === null && initialMachineInitials !== ""
  );
  const prevMachineRef = useRef(initialMachineInitials);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const [state, formAction, isPending] = useActionState(
    submitPublicIssueAction,
    {}
  );

  const selectedMachine = useMemo(
    () => machinesList.find((m) => m.id === selectedMachineId),
    [machinesList, selectedMachineId]
  );

  // Reset form state before navigating away on success (defense in depth).
  // Even though we navigate, clearing first ensures: (1) if navigation fails
  // the user sees an empty form, not stale values; (2) localStorage persistence
  // effect (which short-circuits on state.success) sees clean values; (3) any
  // back-button return to a still-mounted component shows a clean form.
  useEffect(() => {
    if (!state.success) return;

    window.localStorage.removeItem("report_form_state");

    // Native form reset — clears uncontrolled inputs (firstName/lastName/email/website)
    formRef.current?.reset();

    // Controlled state — preserve machine when URL param drove the page,
    // since the user came here specifically to report on that machine.
    setSelectedMachineId(defaultMachineId ?? "");
    // If the machine was user-picked (URL didn't seed it), strip the
    // ?machine= the dropdown's onChange wrote into the URL. Mirrors the
    // Clear-button path so a back-nav or failed redirect leaves a clean URL.
    if (!defaultMachineId && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.has("machine")) {
        params.delete("machine");
        const query = params.toString();
        window.history.replaceState(
          null,
          "",
          query ? `?${query}` : window.location.pathname
        );
      }
    }
    setTitle("");
    setDescription(null);
    setSeverity("minor");
    setPriority("medium");
    setFrequency("constant");
    setStatus("new");
    setAssignedTo("");
    setWatchIssue(true);
    setUploadedImages([]);
    setTurnstileToken("");
    // RichTextEditor and TurnstileWidget are uncontrolled internally —
    // bumping their keys remounts them so visible state matches the cleared
    // controlled state.
    setEditorResetKey((k) => k + 1);
    setTurnstileWidgetKey((k) => k + 1);

    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.success, state.redirectTo, defaultMachineId]);

  // Persistence: Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || hasRestored.current) return;
    hasRestored.current = true;

    const savedDraft = window.localStorage.getItem("report_form_state");
    if (!savedDraft) return;

    try {
      const parsed = JSON.parse(savedDraft) as Partial<{
        machineId: string;
        title: string;
        description: ProseMirrorDoc;
        severity: IssueSeverity | "";
        priority: IssuePriority | "";
        frequency: IssueFrequency | "";
        watchIssue: boolean;
      }>;

      // If URL points to a different machine than the draft, treat this as a new report.
      // If machine matches, keep restoring (this is the login redirect case).
      if (
        defaultMachineId &&
        parsed.machineId &&
        defaultMachineId !== parsed.machineId
      ) {
        window.localStorage.removeItem("report_form_state");
        return;
      }

      if (parsed.machineId && !defaultMachineId) {
        // PP-lql: Only restore the machineId if it still exists in the current
        // machinesList. A stale UUID (deleted machine, different tenant,
        // abandoned draft) would otherwise sit in selectedMachineId while the
        // native <select> silently displays — and submits — the first option's
        // value instead.
        const machine = machinesList.find((m) => m.id === parsed.machineId);
        if (machine) {
          setSelectedMachineId(parsed.machineId);

          // Sync URL with the restored machine when no machine param is present.
          const params = new URLSearchParams(searchParams.toString());
          params.set("machine", machine.initials);
          window.history.replaceState(null, "", `?${params.toString()}`);
        }
      }

      if (parsed.title) setTitle(parsed.title);
      if (parsed.description) setDescription(parsed.description);
      if (parsed.severity) setSeverity(parsed.severity);
      if (parsed.priority) setPriority(parsed.priority);
      if (parsed.frequency) setFrequency(parsed.frequency);
      if (typeof parsed.watchIssue === "boolean")
        setWatchIssue(parsed.watchIssue);
    } catch {
      // Clear corrupted localStorage
      window.localStorage.removeItem("report_form_state");
    }
  }, [defaultMachineId, machinesList, searchParams]);

  // Persistence: Save to localStorage on change (skip after successful submission)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state.success) return;
    const stateToSave = {
      machineId: selectedMachineId,
      title,
      description,
      severity,
      priority,
      frequency,
      watchIssue,
    };
    window.localStorage.setItem(
      "report_form_state",
      JSON.stringify(stateToSave)
    );
  }, [
    selectedMachineId,
    title,
    description,
    severity,
    priority,
    frequency,
    watchIssue,
    state.success,
  ]);

  // Sync with defaultMachineId prop when it changes (from URL)
  useEffect(() => {
    if (defaultMachineId) {
      setSelectedMachineId(defaultMachineId);
    }
  }, [defaultMachineId]);

  // PP-lql defense in depth: if selectedMachineId references a machine that
  // is not in the current list (deleted, tenant switched, etc.), reset to "".
  // The native <select value="<stale-uuid>"> silently shows — and submits —
  // the first option's value otherwise, leading to issues being filed against
  // the wrong machine without any user-visible error.
  useEffect(() => {
    if (
      selectedMachineId &&
      !machinesList.some((m) => m.id === selectedMachineId)
    ) {
      setSelectedMachineId("");
    }
  }, [selectedMachineId, machinesList]);

  // Fetch recent issues when selected machine changes
  useEffect(() => {
    const currentInitials = selectedMachine?.initials ?? "";

    // Skip if machine hasn't actually changed
    if (currentInitials === prevMachineRef.current) return;
    prevMachineRef.current = currentInitials;

    // No machine selected — clear issues
    if (!currentInitials) {
      setIssues([]);
      setIssuesError(false);
      return;
    }

    const cancellation = { cancelled: false };
    setIsLoadingIssues(true);
    setIssuesError(false);

    void (async () => {
      try {
        const result = await getRecentIssuesAction(currentInitials, 5);
        if (cancellation.cancelled) return;
        setIsLoadingIssues(false);
        if (result.ok) {
          setIssues(result.value);
        } else {
          setIssuesError(true);
        }
      } catch {
        if (cancellation.cancelled) return;
        setIsLoadingIssues(false);
        setIssuesError(true);
      }
    })();

    return () => {
      cancellation.cancelled = true;
    };
  }, [selectedMachine?.initials]);

  const canSetWorkflowFields =
    accessLevel === "admin" ||
    accessLevel === "technician" ||
    accessLevel === "member";

  return (
    <div className="w-full">
      <p className="text-sm text-muted-foreground mb-6">
        Tell us what&apos;s going on and the maintenance crew will take it from
        here.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Form Column */}
        <div className="lg:col-span-7 space-y-3 md:space-y-4">
          {(initialError ?? state.error) && (
            <Alert variant="destructive">
              <AlertDescription>{initialError ?? state.error}</AlertDescription>
            </Alert>
          )}

          <form
            action={formAction}
            ref={formRef}
            className="space-y-3 md:space-y-4"
          >
            {/* Honeypot field for bot detection */}
            <input
              type="text"
              name="website"
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />
            <div className="space-y-1.5">
              <Label htmlFor="machineId" className="text-foreground">
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
                  // Update URL silently without triggering navigation
                  const machine = machinesList.find((m) => m.id === newId);
                  if (machine) {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("machine", machine.initials);
                    window.history.replaceState(
                      null,
                      "",
                      `?${params.toString()}`
                    );
                  }
                }}
                className="w-full rounded-md border border-outline-variant bg-surface px-3 h-9 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-[color,background-color,border-color,box-shadow] duration-150"
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
            <div className="lg:hidden">
              <RecentIssuesPanelClient
                machineInitials={selectedMachine?.initials ?? ""}
                issues={issues}
                isLoading={isLoadingIssues}
                isError={issuesError}
                className="border-0 bg-surface-container-low/50 shadow-none p-3"
                limit={3}
                defaultOpen
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="title" className="text-foreground">
                  Issue Title *
                </Label>
                <span
                  className={cn(
                    "text-xs text-muted-foreground transition-opacity duration-150",
                    title.length < 40 && "opacity-0 select-none"
                  )}
                  aria-hidden={title.length < 40}
                >
                  {60 - title.length}/60
                </span>
              </div>
              <Input
                id="title"
                name="title"
                required
                maxLength={60}
                placeholder="e.g., Left flipper not responding"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 border-outline-variant bg-surface text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground">Description</Label>
              <RichTextEditor
                key={editorResetKey}
                content={description}
                onChange={setDescription}
                mentionsEnabled={userAuthenticated}
                placeholder="Tell us what happened, and how often it occurs."
                ariaLabel="Description"
                className="min-h-[80px]"
              />
              <input
                type="hidden"
                name="description"
                value={description ? JSON.stringify(description) : ""}
              />
            </div>

            {/* Severity + Frequency: always side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="severity" className="text-foreground">
                  Severity *
                </Label>
                <input type="hidden" name="severity" value={severity} />
                <SeveritySelect value={severity} onValueChange={setSeverity} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="frequency" className="text-foreground">
                  Frequency *
                </Label>
                <input type="hidden" name="frequency" value={frequency} />
                <FrequencySelect
                  value={frequency}
                  onValueChange={setFrequency}
                  testId="issue-frequency-select"
                />
              </div>
            </div>

            {/* Priority + Status: always side-by-side when visible */}
            {canSetWorkflowFields && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="priority" className="text-foreground">
                    Priority *
                  </Label>
                  <input type="hidden" name="priority" value={priority} />
                  <PrioritySelect
                    value={priority}
                    onValueChange={setPriority}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-foreground">
                    Status *
                  </Label>
                  <input type="hidden" name="status" value={status} />
                  <StatusSelect value={status} onValueChange={setStatus} />
                </div>
              </div>
            )}

            {/* Assign To: full-width */}
            {canSetWorkflowFields && assignees.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="assignedTo" className="text-foreground">
                  Assign To
                </Label>
                <select
                  id="assignedTo"
                  name="assignedTo"
                  data-testid="assigned-to-select"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-md border border-outline-variant bg-surface px-3 h-9 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-[color,background-color,border-color,box-shadow] duration-150"
                >
                  <option value="">Unassigned</option>
                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name ?? "Unnamed User"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Divider before photos */}
            <div className="border-t border-outline-variant/30 pt-3 md:pt-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <ImageUploadButton
                    issueId="new"
                    currentCount={uploadedImages.length}
                    maxCount={userAuthenticated ? 4 : 2}
                    onUploadComplete={(img) =>
                      setUploadedImages((prev) => [...prev, img])
                    }
                    disabled={isPending}
                  />
                </div>

                {uploadedImages.length > 0 && (
                  <div>
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
            {!userAuthenticated && (
              <div className="space-y-2 pt-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Your Information (Optional)
                  </h3>
                </div>
                <div className="space-y-2 rounded-lg border border-outline-variant/30 bg-surface-container-low px-3 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="firstName"
                        className="text-xs text-foreground"
                      >
                        First Name
                      </Label>
                      <Input
                        id="firstName"
                        name="firstName"
                        className="h-8 border-outline-variant bg-surface text-sm text-foreground"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label
                        htmlFor="lastName"
                        className="text-xs text-foreground"
                      >
                        Last Name
                      </Label>
                      <Input
                        id="lastName"
                        name="lastName"
                        className="h-8 border-outline-variant bg-surface text-sm text-foreground"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs text-foreground">
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      className="h-8 border-outline-variant bg-surface text-sm text-foreground"
                    />
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Verified emails link to your profile.
                    </p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground pb-1">
                  Already have an account?{" "}
                  <Link
                    href={getLoginUrl(
                      selectedMachine
                        ? `/report?machine=${selectedMachine.initials}`
                        : "/report"
                    )}
                    className="text-link"
                  >
                    Log in
                  </Link>
                </p>
              </div>
            )}

            {userAuthenticated && (
              <div className="flex items-start gap-3 py-1">
                <Checkbox
                  id="watchIssue"
                  checked={watchIssue}
                  onCheckedChange={(checked) => setWatchIssue(checked === true)}
                  className="mt-0.5 border-outline-variant data-[state=checked]:border-primary"
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="watchIssue"
                    className="text-sm font-medium text-foreground cursor-pointer"
                  >
                    Watch this issue
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Get updates when status or comments change.
                  </p>
                </div>
                <input
                  type="hidden"
                  name="watchIssue"
                  value={watchIssue ? "true" : "false"}
                />
              </div>
            )}

            {!userAuthenticated && (
              <>
                <input
                  type="hidden"
                  name="captchaToken"
                  value={turnstileToken}
                />
                <TurnstileWidget
                  key={turnstileWidgetKey}
                  onVerify={handleTurnstileVerify}
                  onExpire={() => setTurnstileToken("")}
                />
              </>
            )}

            <div className="flex flex-col-reverse gap-2 mt-1 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="sm:w-auto h-10 text-sm font-semibold"
                disabled={isPending}
                onClick={() => setIsClearOpen(true)}
              >
                Clear
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-primary text-on-primary hover:bg-primary/90 h-10 text-sm font-semibold"
                loading={isPending}
                disabled={isPending || (enforceCaptcha && !turnstileToken)}
              >
                Submit Issue Report
              </Button>
            </div>
          </form>

          <AlertDialog open={isClearOpen} onOpenChange={setIsClearOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all fields?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes everything you&apos;ve entered. You can&apos;t
                  undo this.
                  {defaultMachineId &&
                    " The machine selection will be kept since it came from the URL."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    window.localStorage.removeItem("report_form_state");
                    formRef.current?.reset();
                    setSelectedMachineId(defaultMachineId ?? "");
                    // If the machine was user-picked (URL didn't seed it), the
                    // dropdown's onChange wrote ?machine=… into the URL via
                    // history.replaceState. Strip it so a reload doesn't re-select.
                    // Read window.location.search (not the searchParams hook),
                    // since replaceState mutations don't update useSearchParams.
                    if (!defaultMachineId) {
                      const params = new URLSearchParams(
                        window.location.search
                      );
                      if (params.has("machine")) {
                        params.delete("machine");
                        const query = params.toString();
                        window.history.replaceState(
                          null,
                          "",
                          query ? `?${query}` : window.location.pathname
                        );
                      }
                    }
                    setTitle("");
                    setDescription(null);
                    setSeverity("minor");
                    setPriority("medium");
                    setFrequency("constant");
                    setStatus("new");
                    setAssignedTo("");
                    setWatchIssue(true);
                    setUploadedImages([]);
                    setTurnstileToken("");
                    setEditorResetKey((k) => k + 1);
                    setTurnstileWidgetKey((k) => k + 1);
                    setIsClearOpen(false);
                  }}
                >
                  Clear fields
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Right Sidebar: Recent Issues (Desktop) */}
        <div className="hidden lg:block lg:col-span-5 border-l border-outline-variant/50 pl-8">
          <RecentIssuesPanelClient
            machineInitials={selectedMachine?.initials ?? ""}
            issues={issues}
            isLoading={isLoadingIssues}
            isError={issuesError}
            className="border-0 shadow-none bg-transparent p-0"
            limit={5}
          />
        </div>
      </div>
    </div>
  );
}
