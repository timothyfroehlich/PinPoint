import { render, screen } from '@testing-library/react';
import React from 'react';
import { QrCodeDialog } from './qr-code-dialog';
import { describe, it, expect, vi } from 'vitest';

// Mock dependencies
vi.mock('~/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('~/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ComponentProps<'button'>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('~/components/ui/copy-button', () => ({
  CopyButton: () => <button>Copy</button>,
}));

describe('QrCodeDialog', () => {
  it('renders the external link button with accessible label', () => {
    render(
      <QrCodeDialog
        machineName="Test Machine"
        machineInitials="TM"
        qrDataUrl="http://example.com/qr.png"
        reportUrl="http://example.com/report"
      />
    );

    // Look for the external link button
    // It should have an aria-label
    const linkButton = screen.getByTitle('Test Link');
    expect(linkButton).toBeInTheDocument();

    // This is expected to fail initially or warn if we were using a11y testing tools
    // We want to verify it has an aria-label.
    // Currently it does NOT. So let's check for it and expect it to be missing or present depending on stage.
    // For TDD, I'll expect it to have the label and see it fail.

    expect(linkButton).toHaveAttribute('aria-label', 'Open report link in new tab');
  });
});
