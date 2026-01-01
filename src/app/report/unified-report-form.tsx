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
  const [severity, setSeverity] = useState("");

  const [state, formAction, isPending] = useActionState(
    submitPublicIssueAction,
    {}
  );

  const selectedMachine = useMemo(
    () => machinesList.find((m) => m.id === selectedMachineId),
    [machinesList, selectedMachineId]
  );

  // Persistence: Restore from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || hasRestored.current) return;
    hasRestored.current = true;
    const saved = window.localStorage.getItem("report_form_state");
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Partial<{
          machineId: string;
          title: string;
          description: string;
          severity: string;
        }>;
        // Only restore machineId if not provided via prop or URL already
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
    };
    window.localStorage.setItem(
      "report_form_state",
      JSON.stringify(stateToSave)
    );
  }, [selectedMachineId, title, description, severity]);

  // Cleanup: Clear storage on success
  useEffect(() => {
    if (state.success && typeof window !== "undefined") {
      window.localStorage.removeItem("report_form_state");
    }
  }, [state.success]);

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
                <div className="space-y-1.5">
                  <Label htmlFor="machineId" className="text-on-surface">
                    Machine *
                  </Label>
                  <select
                    id="machineId"
                    name="machineId"
                    data-testid="machine-select"
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
                  <Label htmlFor="title" className="text-on-surface">
                    Issue Title *
                  </Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    maxLength={200}
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
                    <select
                      id="severity"
                      name="severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      required
                      className="w-full rounded-md border border-outline-variant bg-surface px-3 h-9 text-sm text-on-surface"
                    >
                      <option value="" disabled>
                        Select severity...
                      </option>
                      <option value="minor">Minor (cosmetic)</option>
                      <option value="playable">
                        Playable (needs attention)
                      </option>
                      <option value="unplayable">
                        Unplayable (machine down)
                      </option>
                    </select>
                  </div>

                  {isAdminOrMember && (
                    <div className="space-y-1.5">
                      <Label htmlFor="priority" className="text-on-surface">
                        Priority *
                      </Label>
                      <select
                        id="priority"
                        name="priority"
                        defaultValue="medium"
                        required
                        className="w-full rounded-md border border-outline-variant bg-surface px-3 h-9 text-sm text-on-surface"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                  )}
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
                    <span>Logged in as {user.email ?? "unknown"}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full bg-primary text-on-primary hover:bg-primary/90 mt-2 h-10 text-sm font-semibold"
                  disabled={!selectedMachineId}
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
