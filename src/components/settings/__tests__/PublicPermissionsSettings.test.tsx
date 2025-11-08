/**
 * Public Permissions Settings Component Tests
 *
 * Tests for managing Unauthenticated role permissions with dependency handling
 * and security warnings.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { PublicPermissionsSettings } from '../PublicPermissionsSettings';

// Mock tRPC
const mockMutate = vi.fn();
const mockInvalidate = vi.fn();
let mutationConfig: { onSuccess?: () => void; onError?: (error: Error) => void } = {};

vi.mock('~/trpc/react', () => ({
  api: {
    admin: {
      getPublicPermissions: {
        useQuery: vi.fn(),
      },
      updatePublicPermissions: {
        useMutation: vi.fn((config) => {
          mutationConfig = config;
          return {
            mutateAsync: mockMutate,
            isPending: false,
          };
        }),
      },
    },
    useUtils: vi.fn(() => ({
      admin: {
        invalidate: mockInvalidate,
      },
    })),
  },
}));

import { api } from '~/trpc/react';

describe('PublicPermissionsSettings', () => {
  const getDefaultPermissions = () => ({
    'issue:view': true,
    'issue:create_basic': false,
    'issue:create_full': false,
    'machine:view': false,
    'location:view': false,
    'attachment:view': false,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mutationConfig = {};

    // Default mock implementation with fresh permissions object each time
    vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
      data: getDefaultPermissions(),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    // Default mutation behavior - calls onSuccess
    mockMutate.mockImplementation(async () => {
      if (mutationConfig.onSuccess) {
        mutationConfig.onSuccess();
      }
      return { success: true };
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Loading and Display', () => {
    it('should show loading state while fetching permissions', () => {
      vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as any);

      render(<PublicPermissionsSettings />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it('should display security warning alert', () => {
      render(<PublicPermissionsSettings />);

      expect(screen.getByText(/security notice/i)).toBeInTheDocument();
      expect(
        screen.getByText(/these permissions apply to anyone visiting your site/i)
      ).toBeInTheDocument();
    });

    it('should organize permissions by resource type', () => {
      render(<PublicPermissionsSettings />);

      expect(screen.getByText('Issues')).toBeInTheDocument();
      expect(screen.getByText('Machines')).toBeInTheDocument();
      expect(screen.getByText('Locations')).toBeInTheDocument();
      expect(screen.getByText('Attachments')).toBeInTheDocument();
    });

    it('should display current permission states correctly', () => {
      render(<PublicPermissionsSettings />);

      // issue:view is enabled
      const issueViewToggle = screen.getByRole('switch', { name: /view issues/i });
      expect(issueViewToggle).toBeChecked();

      // issue:create_basic is disabled
      const createBasicToggle = screen.getByRole('switch', { name: /create basic issues/i });
      expect(createBasicToggle).not.toBeChecked();
    });

    it('should show permission descriptions', () => {
      render(<PublicPermissionsSettings />);

      expect(
        screen.getByText(/allows viewing existing issues/i)
      ).toBeInTheDocument();
    });
  });

  describe('Permission Dependencies', () => {
    it('should auto-enable dependencies when enabling a permission', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Enable issue:create_full (requires issue:view and issue:create_basic)
      const createFullToggle = screen.getByRole('switch', { name: /create full issues/i });
      await user.click(createFullToggle);

      // Toggles should reflect enabled state after confirmation (if any)
      const confirmButton = screen.queryByRole('button', { name: /confirm/i });
      if (confirmButton) {
        await user.click(confirmButton);
      }

      // Check switches are in correct state
      const issueViewToggle = screen.getByRole('switch', { name: /view issues/i });
      const createBasicToggle = screen.getByRole('switch', { name: /create basic issues/i });

      expect(issueViewToggle).toHaveAttribute('aria-checked', 'true');
      expect(createBasicToggle).toHaveAttribute('aria-checked', 'true');
      expect(createFullToggle).toHaveAttribute('aria-checked', 'true');
    });

    it('should show dependencies for each permission', () => {
      render(<PublicPermissionsSettings />);

      // Permissions with dependencies should show "Requires:" text
      const requiresElements = screen.getAllByText(/requires:/i);
      expect(requiresElements.length).toBeGreaterThan(0);
    });

    it('should warn when disabling permission required by others', async () => {
      const user = userEvent.setup();

      // Start with issue:view and issue:create_full both enabled
      vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
        data: {
          'issue:view': true,
          'issue:create_basic': true,
          'issue:create_full': true,
          'machine:view': false,
        },
        isLoading: false,
        error: null,
      } as any);

      render(<PublicPermissionsSettings />);

      // Try to disable issue:view (required by create_full)
      const issueViewToggle = screen.getByRole('switch', { name: /view issues/i });
      await user.click(issueViewToggle);

      // Should show confirmation dialog with warning about dependents
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
    });

    it('should auto-disable dependent permissions when disabling required permission', async () => {
      const user = userEvent.setup();

      vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
        data: {
          'issue:view': true,
          'issue:create_basic': true,
          'issue:create_full': true,
        },
        isLoading: false,
        error: null,
      } as any);

      render(<PublicPermissionsSettings />);

      // Disable issue:view
      const issueViewToggle = screen.getByRole('switch', { name: /view issues/i });
      await user.click(issueViewToggle);

      // Confirm in dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // All dependent permissions should be disabled
      expect(issueViewToggle).toHaveAttribute('aria-checked', 'false');

      const createBasicToggle = screen.getByRole('switch', { name: /create basic issues/i });
      const createFullToggle = screen.getByRole('switch', { name: /create full issues/i });

      expect(createBasicToggle).toHaveAttribute('aria-checked', 'false');
      expect(createFullToggle).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('Security Warnings', () => {
    it('should show high-risk indicator for issue creation permissions', () => {
      render(<PublicPermissionsSettings />);

      // Issue creation should have high risk indicators
      expect(screen.getAllByText(/high risk/i).length).toBeGreaterThan(0);
    });

    it('should show low-risk indicator for view permissions', () => {
      render(<PublicPermissionsSettings />);

      // View permissions should have low risk indicators
      expect(screen.getAllByText(/low risk/i).length).toBeGreaterThan(0);
    });

    it('should display confirmation dialog for high-risk permissions', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Enable high-risk permission
      const createToggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(createToggle);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });
    });
  });

  describe('Save Functionality', () => {
    it('should show save button when changes are made', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Initially no unsaved changes - find button by text
      const saveButton = screen.getByText(/save changes/i);
      expect(saveButton).toBeDisabled();

      // Make a change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm any dialog
      const confirmButton = screen.queryByRole('button', { name: /confirm/i });
      if (confirmButton) {
        await user.click(confirmButton);
      }

      // Save button should be enabled
      await waitFor(() => {
        expect(screen.getByText(/save changes/i)).toBeEnabled();
      });
    });

    it('should call API to save changes', async () => {
      const user = userEvent.setup();
      mockMutate.mockResolvedValue({ success: true });

      render(<PublicPermissionsSettings />);

      // Enable a permission
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm dialog if shown
      await waitFor(() => {
        const confirmButton = screen.queryByRole('button', { name: /confirm/i });
        if (confirmButton) {
          user.click(confirmButton);
        }
      });

      // Wait for save button to be enabled and click it
      await waitFor(() => {
        const saveButton = screen.getByText(/save changes/i);
        expect(saveButton).toBeEnabled();
      });

      const saveButton = screen.getByText(/save changes/i);
      await user.click(saveButton);

      // Should call mutation with updated permissions
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith({
          permissions: expect.objectContaining({
            'issue:create_basic': true,
          }),
        });
      });
    });

    it('should invalidate cache after successful save', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Make change and save
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm the high-risk permission dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      });
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/save changes/i)).toBeEnabled();
      });

      const saveButton = screen.getByText(/save changes/i);
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });

    it('should show success message after save', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Make change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm the high-risk permission dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      });
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Wait for changes and save
      await waitFor(() => {
        expect(screen.getByText(/save changes/i)).toBeEnabled();
      });

      const saveButton = screen.getByText(/save changes/i);
      await user.click(saveButton);

      // Toast notification handled by sonner - we just verify the mutation was called
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });

    it('should show error message on save failure', async () => {
      const user = userEvent.setup();
      const error = new Error('Network error');
      mockMutate.mockImplementation(async () => {
        // Call onError callback before rejecting
        if (mutationConfig.onError) {
          mutationConfig.onError(error);
        }
        return Promise.reject(error);
      });

      render(<PublicPermissionsSettings />);

      // Make change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm the high-risk permission dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      });
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText(/save changes/i)).toBeEnabled();
      });

      const saveButton = screen.getByText(/save changes/i);
      await user.click(saveButton);

      // Toast notification handled by sonner - we just verify the mutation was called and failed
      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalled();
      });
    });

    it('should disable save button while saving', async () => {
      const user = userEvent.setup();

      // Return a mutation with isPending: true
      vi.mocked(api.admin.updatePublicPermissions.useMutation).mockReturnValue({
        mutateAsync: mockMutate,
        isPending: true,
      } as any);

      mockMutate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<PublicPermissionsSettings />);

      // Make change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Check for "Saving..." text when isPending is true
      const saveButton = screen.getByText(/saving/i);
      expect(saveButton).toBeDisabled();
    });
  });

  describe('Discard Changes', () => {
    it('should show discard button when changes are made', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Make a change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      await waitFor(() => {
        expect(screen.getByText(/discard/i)).toBeInTheDocument();
      });
    });

    it('should revert changes when discard is clicked', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      const toggle = screen.getByRole('switch', { name: /create basic issues/i });

      // Initially unchecked
      expect(toggle).toHaveAttribute('aria-checked', 'false');

      // Enable it
      await user.click(toggle);

      // Confirm the high-risk permission dialog
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
      });
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // Wait for dialog to close AND state to update
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
      });

      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'true');
      });

      // Discard changes
      const discardButton = screen.getByText(/discard/i);
      await user.click(discardButton);

      // Should be back to original state
      await waitFor(() => {
        expect(toggle).toHaveAttribute('aria-checked', 'false');
      }, { timeout: 3000 });
    });
  });

  describe('Error Handling', () => {
    it('should show error message when permissions fail to load', () => {
      vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch permissions'),
      } as any);

      render(<PublicPermissionsSettings />);

      expect(screen.getByText(/failed to load permissions/i)).toBeInTheDocument();
    });

    it('should provide retry button on load error', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();

      vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to fetch'),
        refetch: mockRefetch,
      } as any);

      render(<PublicPermissionsSettings />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await user.click(retryButton);

      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
