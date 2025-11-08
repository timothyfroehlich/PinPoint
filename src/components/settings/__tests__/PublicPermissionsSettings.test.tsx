/**
 * Public Permissions Settings Component Tests
 *
 * Tests for managing Unauthenticated role permissions with dependency handling
 * and security warnings.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { PublicPermissionsSettings } from '../PublicPermissionsSettings';

// Mock tRPC
const mockMutate = vi.fn();
const mockInvalidate = vi.fn();

vi.mock('~/trpc/react', () => ({
  api: {
    admin: {
      getPublicPermissions: {
        useQuery: vi.fn(),
      },
      updatePublicPermissions: {
        useMutation: vi.fn(() => ({
          mutateAsync: mockMutate,
          isPending: false,
        })),
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
  const mockPermissions = {
    'issue:view': true,
    'issue:create_basic': false,
    'issue:create_full': false,
    'machine:view': false,
    'location:view': false,
    'attachment:view': false,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation
    vi.mocked(api.admin.getPublicPermissions.useQuery).mockReturnValue({
      data: mockPermissions,
      isLoading: false,
      error: null,
    } as any);
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

      // Should show dependency message
      expect(
        screen.getByText(/also enables.*issue:view.*issue:create_basic/i)
      ).toBeInTheDocument();

      // Toggles should reflect enabled state
      const issueViewToggle = screen.getByRole('switch', { name: /view issues/i });
      const createBasicToggle = screen.getByRole('switch', { name: /create basic issues/i });

      expect(issueViewToggle).toBeChecked();
      expect(createBasicToggle).toBeChecked();
      expect(createFullToggle).toBeChecked();
    });

    it('should show dependencies for each permission', () => {
      render(<PublicPermissionsSettings />);

      // issue:create_full should show its dependencies
      expect(
        screen.getByText(/requires.*view issues.*create basic issues/i)
      ).toBeInTheDocument();
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

      // Should show warning
      expect(
        screen.getByText(/disabling this will also disable.*create full issues/i)
      ).toBeInTheDocument();
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
      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await user.click(confirmButton);

      // All dependent permissions should be disabled
      expect(issueViewToggle).not.toBeChecked();

      const createBasicToggle = screen.getByRole('switch', { name: /create basic issues/i });
      const createFullToggle = screen.getByRole('switch', { name: /create full issues/i });

      expect(createBasicToggle).not.toBeChecked();
      expect(createFullToggle).not.toBeChecked();
    });
  });

  describe('Security Warnings', () => {
    it('should show high-risk indicator for issue creation permissions', () => {
      render(<PublicPermissionsSettings />);

      // Issue creation should have security warnings
      const createSection = screen.getByText(/create basic issues/i).closest('div');
      expect(createSection).toHaveTextContent(/high risk/i);
    });

    it('should show moderate-risk indicator for view permissions', () => {
      render(<PublicPermissionsSettings />);

      const viewSection = screen.getByText(/view issues/i).closest('div');
      expect(viewSection).toHaveTextContent(/low risk/i);
    });

    it('should display confirmation dialog for high-risk permissions', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Enable high-risk permission
      const createToggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(createToggle);

      // Should show confirmation dialog
      expect(
        screen.getByText(/are you sure you want to enable this permission/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/this allows anyone to create issues/i)
      ).toBeInTheDocument();
    });
  });

  describe('Save Functionality', () => {
    it('should show save button when changes are made', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Initially no unsaved changes
      expect(screen.queryByRole('button', { name: /save changes/i })).toBeDisabled();

      // Make a change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm any dialog
      const confirmButton = screen.queryByRole('button', { name: /confirm/i });
      if (confirmButton) {
        await user.click(confirmButton);
      }

      // Save button should be enabled
      expect(screen.getByRole('button', { name: /save changes/i })).toBeEnabled();
    });

    it('should call API to save changes', async () => {
      const user = userEvent.setup();
      mockMutate.mockResolvedValue({ success: true });

      render(<PublicPermissionsSettings />);

      // Enable a permission
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      // Confirm dialog if shown
      const confirmButton = screen.queryByRole('button', { name: /confirm/i });
      if (confirmButton) {
        await user.click(confirmButton);
      }

      // Click save
      const saveButton = screen.getByRole('button', { name: /save changes/i });
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
      mockMutate.mockResolvedValue({ success: true });

      render(<PublicPermissionsSettings />);

      // Make change and save
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockInvalidate).toHaveBeenCalled();
      });
    });

    it('should show success message after save', async () => {
      const user = userEvent.setup();
      mockMutate.mockResolvedValue({ success: true });

      render(<PublicPermissionsSettings />);

      // Make change and save
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/permissions updated successfully/i)).toBeInTheDocument();
      });
    });

    it('should show error message on save failure', async () => {
      const user = userEvent.setup();
      mockMutate.mockRejectedValue(new Error('Network error'));

      render(<PublicPermissionsSettings />);

      // Make change and save
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/failed to update permissions/i)).toBeInTheDocument();
      });
    });

    it('should disable save button while saving', async () => {
      const user = userEvent.setup();
      mockMutate.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<PublicPermissionsSettings />);

      // Make change and save
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      const saveButton = screen.getByRole('button', { name: /save changes/i });
      await user.click(saveButton);

      // Should be disabled while saving
      expect(saveButton).toBeDisabled();
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Discard Changes', () => {
    it('should show discard button when changes are made', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      // Make a change
      const toggle = screen.getByRole('switch', { name: /create basic issues/i });
      await user.click(toggle);

      expect(screen.getByRole('button', { name: /discard/i })).toBeInTheDocument();
    });

    it('should revert changes when discard is clicked', async () => {
      const user = userEvent.setup();

      render(<PublicPermissionsSettings />);

      const toggle = screen.getByRole('switch', { name: /create basic issues/i });

      // Initially unchecked
      expect(toggle).not.toBeChecked();

      // Enable it
      await user.click(toggle);
      expect(toggle).toBeChecked();

      // Discard changes
      const discardButton = screen.getByRole('button', { name: /discard/i });
      await user.click(discardButton);

      // Should be back to original state
      expect(toggle).not.toBeChecked();
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
