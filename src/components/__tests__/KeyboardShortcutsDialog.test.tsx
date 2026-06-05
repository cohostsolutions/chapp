import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';

describe('KeyboardShortcutsDialog', () => {
  it('renders the dialog when open', () => {
    const onOpenChange = vi.fn();
    render(
      <KeyboardShortcutsDialog isOpen={true} onOpenChange={onOpenChange} />
    );
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    expect(screen.getByText(/Use these keyboard shortcuts/)).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <KeyboardShortcutsDialog isOpen={false} onOpenChange={onOpenChange} />
    );
    
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('displays all keyboard shortcuts', () => {
    const onOpenChange = vi.fn();
    render(
      <KeyboardShortcutsDialog isOpen={true} onOpenChange={onOpenChange} />
    );
    
    expect(screen.getByText(/Previous \/ Next day/)).toBeInTheDocument();
    expect(screen.getByText(/Create new event/)).toBeInTheDocument();
    expect(screen.getByText(/Jump to today/)).toBeInTheDocument();
    expect(screen.getByText(/Edit selected event/)).toBeInTheDocument();
    expect(screen.getByText(/Delete selected event/)).toBeInTheDocument();
    expect(screen.getByText(/Open calendar manager/)).toBeInTheDocument();
    expect(screen.getByText(/Sync with Google Calendar/)).toBeInTheDocument();
  });

  it('shows helpful tip at the bottom', () => {
    const onOpenChange = vi.fn();
    render(
      <KeyboardShortcutsDialog isOpen={true} onOpenChange={onOpenChange} />
    );
    
    expect(screen.getByText(/Shortcuts only work when you're not typing/)).toBeInTheDocument();
  });

  it('calls onOpenChange when dialog is closed', () => {
    const onOpenChange = vi.fn();
    render(
      <KeyboardShortcutsDialog isOpen={true} onOpenChange={onOpenChange} />
    );

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
