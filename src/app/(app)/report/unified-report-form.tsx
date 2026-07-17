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
import { ImageUploadButton } from "~/components/images/ImageUploadButton";
import { ImageGallery } from "~/components/images/ImageGallery";
import type { AccessLevel } from "~/lib/permissions/matrix";
import { TurnstileWidget } from "~/components/security/TurnstileWidget";
import { getLoginUrl } from "~/lib/login-url";
import { RecentIssuesPanelClient } from "~/components/issues/RecentIssuesPanelClient";
import { RichTextEditor } from "~/components/editor/RichTextEditorDynamic";
import { MachineCombobox } from "~/components/machines/MachineCombobox";
import { useReportDraft } from "./report-draft-store";
import { defaultEntry } from "./report-draft-schema";
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

// Type-only fallback so `entries[0]` reads are non-optional. The provider always
// guarantees at least one entry, so this is never actually rendered.
const FALLBACK_ENTRY = defaultEntry("00000000-0000-0000-0000-000000000000");

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
  const formRef = useRef<HTMLFormElement>(null);
  const [isClearOpen, setIsClearOpen] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  // Bumped to remount the Turnstile widget on reset — its internal "solved"
  // state is otherwise out of sync with the cleared hidden token.
  const [turnstileWidgetKey, setTurnstileWidgetKey] = useState(0);
  // CAPTCHA token is ephemeral (never persisted in the shared draft).
  const [turnstileToken, setTurnstileToken] = useState("");

  // The shared draft is the single source of truth for the synced entry-#1
  // fields + the reporter identity/photos. Persistence + hydration + legacy
  // migration all live in the provider now — the form owns none of it.
  const { entries, single, patchEntry, patchSingle, clearAll, hydrated } =
    useReportDraft();
  const entry = entries[0] ?? FALLBACK_ENTRY;

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
    () => machinesList.find((m) => m.id === entry.machineId),
    [machinesList, entry.machineId]
  );

  // The report form submits the machine's id (as `machineId`), so each option's
  // combobox `value` is the machine id.
  const machineOptions = useMemo(
    () =>
      machinesList.map((m) => ({
        value: m.id,
        name: m.name,
        initials: m.initials,
      })),
    [machinesList]
  );

  // Mirrors the previous native <select> onChange: track the selection and
  // silently sync ?machine=<initials> into the URL (no navigation) so a reload
  // or a "Log in" round-trip lands back on the same machine.
  const handleMachineChange = useCallback(
    (newId: string) => {
      patchEntry(0, { machineId: newId });
      const machine = machinesList.find((m) => m.id === newId);
      if (machine) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("machine", machine.initials);
        window.history.replaceState(null, "", `?${params.toString()}`);
      }
    },
    [machinesList, searchParams, patchEntry]
  );

  // Reset the single view back to a fresh report: blank entry #1 (fresh
  // idempotency key), empty reporter identity/photos, cleared draft storage,
  // remounted rich editor + CAPTCHA. Shared by the success effect and the Clear
  // dialog. Machine is preserved when it came from the URL (?machine=), matching
  // the prior behavior — the user came here to report on that specific machine.
  const resetSingleForm = useCallback(() => {
    clearAll();
    if (defaultMachineId) patchEntry(0, { machineId: defaultMachineId });
    // Native form reset — clears the honeypot and any browser autofill that
    // bypassed controlled inputs.
    formRef.current?.reset();
    // If the machine was user-picked (URL didn't seed it), strip the ?machine=
    // the combobox's onChange wrote via replaceState so a reload/back-nav leaves
    // a clean URL. Read window.location.search (not the searchParams hook), since
    // replaceState mutations don't update useSearchParams.
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
    setTurnstileToken("");
    setEditorResetKey((k) => k + 1);
    setTurnstileWidgetKey((k) => k + 1);
  }, [clearAll, patchEntry, defaultMachineId]);

  // Reset form state before navigating away on success (defense in depth): if
  // navigation fails the user sees an empty form, not stale values, and a
  // back-button return to a still-mounted component shows a clean form.
  useEffect(() => {
    if (!state.success) return;
    resetSingleForm();
    if (state.redirectTo) {
      window.location.assign(state.redirectTo);
    }
  }, [state.success, state.redirectTo, resetSingleForm]);

  // Honor a URL ?machine= over a restored draft. Gated on `hydrated` so it runs
  // AFTER the provider's mount-time restore (which would otherwise clobber the
  // seed, since the provider is an ancestor and its effect runs last). Machine
  // wins; the rest of the draft (title/description/…) is preserved.
  useEffect(() => {
    if (!hydrated) return;
    if (defaultMachineId) patchEntry(0, { machineId: defaultMachineId });
  }, [hydrated, defaultMachineId, patchEntry]);

  // PP-lql defense in depth: if entry #1 references a machine no longer in the
  // list (deleted, tenant switched), reset it to "". A stale UUID would
  // otherwise sit selected while the combobox submits nothing meaningful.
  useEffect(() => {
    if (
      entry.machineId &&
      !machinesList.some((m) => m.id === entry.machineId)
    ) {
      patchEntry(0, { machineId: "" });
    }
  }, [entry.machineId, machinesList, patchEntry]);

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
            {/* Idempotency key — stable per fresh form; dedupes retries (PP-2053.7) */}
            <input
              type="hidden"
              name="idempotencyKey"
              value={entry.idempotencyKey}
            />
            <div className="space-y-1.5">
              <Label htmlFor="machineId" className="text-foreground">
                Machine *
              </Label>
              <MachineCombobox
                id="machineId"
                name="machineId"
                machines={machineOptions}
                value={entry.machineId}
                onValueChange={handleMachineChange}
                ariaLabel="Select Machine"
                placeholder="Select a machine…"
                triggerClassName="h-9"
              />
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
                    entry.title.length < 40 && "opacity-0 select-none"
                  )}
                  aria-hidden={entry.title.length < 40}
                >
                  {60 - entry.title.length}/60
                </span>
              </div>
              <Input
                id="title"
                name="title"
                required
                maxLength={60}
                placeholder="e.g., Left flipper not responding"
                value={entry.title}
                onChange={(e) => patchEntry(0, { title: e.target.value })}
                className="h-9 border-outline-variant bg-surface text-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground">Description</Label>
              <RichTextEditor
                key={editorResetKey}
                content={entry.description}
                onChange={(doc) => patchEntry(0, { description: doc })}
                mentionsEnabled={userAuthenticated}
                placeholder="Tell us what happened, and how often it occurs."
                ariaLabel="Description"
                className="min-h-[80px]"
              />
              <input
                type="hidden"
                name="description"
                value={
                  entry.description ? JSON.stringify(entry.description) : ""
                }
              />
            </div>

            {/* Severity + Frequency: always side-by-side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="severity" className="text-foreground">
                  Severity *
                </Label>
                <input type="hidden" name="severity" value={entry.severity} />
                <SeveritySelect
                  id="severity"
                  value={entry.severity}
                  onValueChange={(v) => patchEntry(0, { severity: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="frequency" className="text-foreground">
                  Frequency *
                </Label>
                <input type="hidden" name="frequency" value={entry.frequency} />
                <FrequencySelect
                  id="frequency"
                  value={entry.frequency}
                  onValueChange={(v) => patchEntry(0, { frequency: v })}
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
                  <input type="hidden" name="priority" value={entry.priority} />
                  <PrioritySelect
                    id="priority"
                    value={entry.priority}
                    onValueChange={(v) => patchEntry(0, { priority: v })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-foreground">
                    Status *
                  </Label>
                  <input type="hidden" name="status" value={entry.status} />
                  <StatusSelect
                    id="status"
                    value={entry.status}
                    onValueChange={(v) => patchEntry(0, { status: v })}
                  />
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
                  value={entry.assignedTo}
                  onChange={(e) =>
                    patchEntry(0, { assignedTo: e.target.value })
                  }
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
                    currentCount={single.uploadedImages.length}
                    maxCount={userAuthenticated ? 4 : 2}
                    onUploadComplete={(img) =>
                      patchSingle({
                        uploadedImages: [...single.uploadedImages, img],
                      })
                    }
                    disabled={isPending}
                  />
                </div>

                {single.uploadedImages.length > 0 && (
                  <div>
                    <ImageGallery
                      images={single.uploadedImages.map((img) => ({
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
                  value={JSON.stringify(single.uploadedImages)}
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
                        autoComplete="given-name"
                        value={single.firstName}
                        onChange={(e) =>
                          patchSingle({ firstName: e.target.value })
                        }
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
                        autoComplete="family-name"
                        value={single.lastName}
                        onChange={(e) =>
                          patchSingle({ lastName: e.target.value })
                        }
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
                      autoComplete="email"
                      value={single.email}
                      onChange={(e) => patchSingle({ email: e.target.value })}
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
                  checked={entry.watch}
                  onCheckedChange={(checked) =>
                    patchEntry(0, { watch: checked === true })
                  }
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
                  value={entry.watch ? "true" : "false"}
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

            {/* sm-structural-allow: TODO PP-kqbk follow-up — convert to @container */}
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
                disabled={
                  isPending ||
                  // The combobox submits via a hidden input, which the browser
                  // can't `required`-validate — gate the button instead so a
                  // report can't be filed without a machine (replaces the native
                  // <select required>).
                  !entry.machineId ||
                  (enforceCaptcha && !turnstileToken)
                }
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
                    resetSingleForm();
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
