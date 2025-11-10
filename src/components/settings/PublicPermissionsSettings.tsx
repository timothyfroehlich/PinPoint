'use client';

/**
 * Public Permissions Settings Component
 *
 * Manages permissions for the Unauthenticated role (anonymous/public users).
 * Handles permission dependencies, security warnings, and bulk updates.
 */

import { useState, useEffect } from 'react';
import { AlertCircle, Shield, AlertTriangle, Info } from 'lucide-react';
import { api } from '~/trpc/react';
import { Button } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '~/components/ui/alert';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '~/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog';
import { toast } from 'sonner';

// Permission metadata
interface PermissionMetadata {
  id: string;
  label: string;
  description: string;
  category: 'Issues' | 'Machines' | 'Locations' | 'Attachments';
  riskLevel: 'low' | 'moderate' | 'high';
  dependencies?: string[];
}

const PERMISSION_METADATA: PermissionMetadata[] = [
  // Issues
  {
    id: 'issue:view',
    label: 'View Issues',
    description: 'Allows viewing existing issues',
    category: 'Issues',
    riskLevel: 'low',
  },
  {
    id: 'issue:create_basic',
    label: 'Create Basic Issues',
    description: 'Allows creating issues without attachments',
    category: 'Issues',
    riskLevel: 'high',
    dependencies: ['issue:view'],
  },
  {
    id: 'issue:create_full',
    label: 'Create Full Issues',
    description: 'Allows creating issues with all fields and attachments',
    category: 'Issues',
    riskLevel: 'high',
    dependencies: ['issue:view', 'issue:create_basic'],
  },
  // Machines
  {
    id: 'machine:view',
    label: 'View Machines',
    description: 'Allows viewing machine information',
    category: 'Machines',
    riskLevel: 'low',
  },
  // Locations
  {
    id: 'location:view',
    label: 'View Locations',
    description: 'Allows viewing location information',
    category: 'Locations',
    riskLevel: 'low',
  },
  // Attachments
  {
    id: 'attachment:view',
    label: 'View Attachments',
    description: 'Allows viewing issue attachments',
    category: 'Attachments',
    riskLevel: 'low',
  },
];

type PermissionState = Record<string, boolean>;

interface ConfirmationDialog {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
}

export function PublicPermissionsSettings(): JSX.Element {
  const utils = api.useUtils();

  // Fetch current permissions
  const {
    data: currentPermissions,
    isLoading,
    error,
    refetch,
  } = api.admin.getPublicPermissions.useQuery();

  // Local state for editing
  const [permissions, setPermissions] = useState<PermissionState>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmationDialog>({
    open: false,
    title: '',
    description: '',
    onConfirm: () => undefined,
  });

  // Update mutation
  const updateMutation = api.admin.updatePublicPermissions.useMutation({
    onSuccess: () => {
      toast.success('Permissions updated successfully');
      void utils.admin.invalidate();
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error(`Failed to update permissions: ${error.message}`);
    },
  });

  // Sync local state with fetched data
  useEffect(() => {
    if (currentPermissions) {
      setPermissions(currentPermissions);
    }
  }, [currentPermissions]);

  // Check if there are unsaved changes
  useEffect(() => {
    if (!currentPermissions) return;

    const changed = Object.keys(permissions).some(
      (key) => permissions[key] !== currentPermissions[key]
    );
    setHasChanges(changed);
  }, [permissions, currentPermissions]);

  const handleToggle = (permissionId: string, enabled: boolean): void => {
    const metadata = PERMISSION_METADATA.find((p) => p.id === permissionId);

    // High-risk permissions require confirmation
    if (enabled && metadata?.riskLevel === 'high') {
      setConfirmDialog({
        open: true,
        title: 'Enable High-Risk Permission?',
        description: `Are you sure you want to enable this permission? This allows anyone to ${metadata.description.toLowerCase()}.`,
        onConfirm: () => {
          applyPermissionChange(permissionId, enabled);
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
      return;
    }

    // Disabling permissions that others depend on requires confirmation
    if (!enabled) {
      const dependents = getDependentPermissions(permissionId);
      if (dependents.length > 0) {
        const dependentLabels = dependents
          .map((id) => PERMISSION_METADATA.find((p) => p.id === id)?.label)
          .filter(Boolean)
          .join(', ');

        setConfirmDialog({
          open: true,
          title: 'Disable Permission?',
          description: `Disabling this will also disable: ${dependentLabels}`,
          onConfirm: () => {
            applyPermissionChange(permissionId, enabled);
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          },
        });
        return;
      }
    }

    applyPermissionChange(permissionId, enabled);
  };

  const applyPermissionChange = (
    permissionId: string,
    enabled: boolean,
  ): void => {
    const metadata = PERMISSION_METADATA.find((p) => p.id === permissionId);
    const newPermissions = { ...permissions };

    if (enabled) {
      // Enable this permission
      newPermissions[permissionId] = true;

      // Auto-enable dependencies
      if (metadata?.dependencies) {
        metadata.dependencies.forEach((depId) => {
          newPermissions[depId] = true;
        });
      }
    } else {
      // Disable this permission
      newPermissions[permissionId] = false;

      // Auto-disable dependents
      const dependents = getDependentPermissions(permissionId);
      dependents.forEach((depId) => {
        newPermissions[depId] = false;
      });
    }

    setPermissions(newPermissions);
  };

  const getDependentPermissions = (permissionId: string): string[] => {
    return PERMISSION_METADATA.filter(
      (p) => p.dependencies?.includes(permissionId)
    ).map((p) => p.id);
  };

  const savePermissions = async (): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ permissions });
    } catch (error) {
      // Error is already handled by onError callback in mutation config
      // This catch prevents unhandled promise rejection
    }
  };

  const handleSaveClick = (): void => {
    void savePermissions();
  };

  const handleDiscard = (): void => {
    if (currentPermissions) {
      setPermissions(currentPermissions);
    }
  };
  const handleRetry = (): void => {
    void refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Loading permissions...</div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <p className="text-destructive mb-4">Failed to load permissions</p>
            <Button onClick={handleRetry} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group permissions by category
  const categories = ['Issues', 'Machines', 'Locations', 'Attachments'] as const;
  const permissionsByCategory = categories.map((category) => ({
    name: category,
    permissions: PERMISSION_METADATA.filter((p) => p.category === category),
  }));

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Public Permissions</CardTitle>
          <CardDescription>
            Control what unauthenticated visitors can do
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Security Warning */}
          <Alert variant="default" className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Security Notice</AlertTitle>
            <AlertDescription>
              These permissions apply to anyone visiting your site without logging in.
              Only enable what's necessary for your use case.
            </AlertDescription>
          </Alert>

          {/* Permission Categories */}
          {permissionsByCategory.map((category) => (
            <div key={category.name} className="space-y-4">
              <h3 className="text-sm font-medium">{category.name}</h3>
              <div className="space-y-3">
                {category.permissions.map((perm) => {
                  const isEnabled = permissions[perm.id] ?? false;
                  const dependencyLabels = perm.dependencies
                    ?.map((id) => PERMISSION_METADATA.find((p) => p.id === id)?.label)
                    .filter(Boolean)
                    .join(', ');

                  return (
                    <div
                      key={perm.id}
                      className="flex items-start justify-between gap-4 rounded-lg border p-4"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor={perm.id}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {perm.label}
                          </label>
                          {perm.riskLevel === 'high' && (
                            <span className="inline-flex items-center gap-1 text-xs text-red-600">
                              <AlertTriangle className="h-3 w-3" />
                              High Risk
                            </span>
                          )}
                          {perm.riskLevel === 'moderate' && (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                              <Shield className="h-3 w-3" />
                              Moderate Risk
                            </span>
                          )}
                          {perm.riskLevel === 'low' && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <Info className="h-3 w-3" />
                              Low Risk
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{perm.description}</p>
                        {dependencyLabels && (
                          <p className="text-xs text-muted-foreground">
                            Requires: {dependencyLabels}
                          </p>
                        )}
                        {isEnabled && perm.dependencies && (
                          <p className="text-xs text-blue-600">
                            Also enables: {dependencyLabels}
                          </p>
                        )}
                      </div>
                      <Switch
                        id={perm.id}
                        checked={isEnabled}
                        onCheckedChange={(checked) => {
                          handleToggle(perm.id, checked);
                        }}
                        aria-label={perm.label}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>

        <CardFooter className="flex justify-between border-t pt-6">
          <Button
            variant="outline"
            onClick={handleDiscard}
            disabled={!hasChanges || updateMutation.isPending}
          >
            Discard
          </Button>
          <Button
            onClick={handleSaveClick}
            disabled={!hasChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardFooter>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          setConfirmDialog((prev) => ({ ...prev, open }));
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
